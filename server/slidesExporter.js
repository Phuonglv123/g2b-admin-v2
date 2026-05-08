import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template Slide ID
const TEMPLATE_SLIDE_ID =
  process.env.GOOGLE_SLIDES_TEMPLATE_ID ||
  "1XgYlc3oQdNfqnz0dar-J_JHLHINFUQfR56LfT4ys9J0";
const GOOGLE_DRIVE_UPLOAD_FOLDER_ID = process.env.GOOGLE_DRIVE_UPLOAD_FOLDER_ID || null;

// Placeholder image for products without photos
// A simple grey image with "No Image" text, hosted on a reliable public CDN
const PLACEHOLDER_IMAGE_URL = process.env.PLACEHOLDER_IMAGE_URL || 'https://placehold.co/800x600/e2e8f0/64748b?text=No+Image+Available';

// EMU constants (1 inch = 914400 EMU)
const EMU_PER_INCH = 914400;

// Rounded corner radius in pixels (adjust to taste)
const ROUNDED_CORNER_RADIUS = 40;

// Target image positions/sizes on slide (in inches, converted to EMU)
// Based on template layout: right ~47% of slide is the photo area
// Image 1: Top-right hero — map/street view covering upper-right (slightly smaller)
const IMAGE_TARGETS = [
  { x: 5.0 * EMU_PER_INCH, y: 0.2 * EMU_PER_INCH, w: 4.2 * EMU_PER_INCH, h: 2.8 * EMU_PER_INCH },
  // Image 2: Bottom-right feature — ~half the size of image 1
  { x: 6.8 * EMU_PER_INCH, y: 3.2 * EMU_PER_INCH, w: 2.6 * EMU_PER_INCH, h: 1.6 * EMU_PER_INCH },
];

// Scopes for Google Slides & Drive
const SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
];

let cachedDriveUploadParent = undefined;

/**
 * Get authenticated Google API client using service account
 */
async function getAuthClient() {
  const keyPath = path.join(__dirname, 'service-account.json');
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: SCOPES,
  });
  return auth;
}

async function getDriveUploadParent(drive) {
  if (cachedDriveUploadParent !== undefined) return cachedDriveUploadParent;
  if (GOOGLE_DRIVE_UPLOAD_FOLDER_ID) {
    cachedDriveUploadParent = GOOGLE_DRIVE_UPLOAD_FOLDER_ID;
    return cachedDriveUploadParent;
  }

  try {
    const file = await drive.files.get({
      fileId: TEMPLATE_SLIDE_ID,
      supportsAllDrives: true,
      fields: 'parents',
    });
    cachedDriveUploadParent = file.data.parents?.[0] || null;
  } catch (err) {
    console.warn(`⚠️ Could not resolve Drive upload parent: ${err.message}`);
    cachedDriveUploadParent = null;
  }

  return cachedDriveUploadParent;
}

/**
 * Apply rounded corners to an image buffer using sharp.
 * Creates an SVG rounded-rectangle mask and composites it to produce PNG with transparent corners.
 */
async function applyRoundedCorners(inputBuffer, radius = ROUNDED_CORNER_RADIUS) {
  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width;
  const height = metadata.height;

  const mask = Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  );

  return sharp(inputBuffer)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/**
 * Upload an image from a URL to Google Drive so Google Slides can access it.
 * Returns a publicly accessible Google Drive content URL.
 * This solves the problem where self-hosted Supabase URLs are not reachable by Google servers.
 */
async function proxyImageToDrive(drive, imageUrl, { roundCorners = true } = {}) {
  try {
    // Download image from the original URL
    const response = await fetch(imageUrl, { 
      signal: AbortSignal.timeout(15000), // 15s timeout
      headers: { 'User-Agent': 'G2B-Media-Export/1.0' },
    });
    if (!response.ok) {
      console.warn(`⚠️ Failed to download image (${response.status}): ${imageUrl}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    let buffer = Buffer.from(await response.arrayBuffer());
    
    if (buffer.length < 100) {
      console.warn(`⚠️ Image too small (${buffer.length} bytes), likely broken: ${imageUrl}`);
      return null;
    }

    // Apply rounded corners
    if (roundCorners) {
      try {
        buffer = await applyRoundedCorners(buffer);
        console.log(`  🔲→🔳 Applied rounded corners to image (${(buffer.length / 1024).toFixed(1)} KB)`);
      } catch (rcErr) {
        console.warn(`  ⚠️ Rounded corners failed, using original: ${rcErr.message}`);
      }
    }

    // After rounding, image is always PNG
    const uploadMimeType = roundCorners ? 'image/png' : contentType;
    const ext = roundCorners ? 'png' : 'jpg';

    // Upload to Google Drive
    const fileMetadata = {
      name: `g2b-export-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`,
      mimeType: uploadMimeType,
    };
    const parentFolderId = await getDriveUploadParent(drive);
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const media = {
      mimeType: uploadMimeType,
      body: Readable.from(buffer),
    };

    const driveFile = await drive.files.create({
      supportsAllDrives: true,
      requestBody: fileMetadata,
      media,
      fields: 'id, webContentLink',
    });

    const fileId = driveFile.data.id;

    // Make the file publicly readable
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Wait for permission propagation so Google Slides can access the image
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Use Google's CDN URL — returns raw image bytes without redirects.
    // This is the most reliable URL format for Google Slides replaceImage API.
    const driveUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    console.log(`✅ Proxied image to Drive: ${fileId} (${(buffer.length / 1024).toFixed(1)} KB) → ${driveUrl}`);
    return { url: driveUrl, fileId };
  } catch (err) {
    console.warn(`⚠️ Image proxy failed for ${imageUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Clean up temporary Drive files after export
 */
async function cleanupDriveFiles(drive, fileIds) {
  for (const fileId of fileIds) {
    try {
      await drive.files.delete({ fileId });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Insert product images into a slide using createImage API.
 * Tries direct URL first; falls back to proxying through Google Drive.
 * Returns array of temp Drive file IDs for cleanup.
 */
async function insertImagesOnSlide(slides, drive, presentationId, slideId, imageUrls) {
  const tempFileIds = [];

  for (let j = 0; j < Math.min(imageUrls.length, IMAGE_TARGETS.length); j++) {
    const imgUrl = imageUrls[j];
    if (!imgUrl) continue;
    const target = IMAGE_TARGETS[j];

    // Always proxy through Drive to apply rounded corners
    const proxied = await proxyImageToDrive(drive, imgUrl);
    const finalUrl = proxied ? proxied.url : imgUrl;
    if (proxied) tempFileIds.push(proxied.fileId);

    const createReq = {
      createImage: {
        url: finalUrl,
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: target.w, unit: 'EMU' },
            height: { magnitude: target.h, unit: 'EMU' },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: target.x,
            translateY: target.y,
            shearX: 0,
            shearY: 0,
            unit: 'EMU',
          },
        },
      },
    };

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: [createReq] },
      });
      console.log(`  ✅ Created image ${j} on slide ${slideId}${proxied ? ' (rounded corners)' : ''}`);
    } catch (err) {
      console.warn(`  ⚠️ createImage failed for image ${j} on slide ${slideId}: ${err.message}`);
      // If proxied URL failed, try original URL as last resort
      if (proxied) {
        createReq.createImage.url = imgUrl;
        try {
          await slides.presentations.batchUpdate({
            presentationId,
            requestBody: { requests: [createReq] },
          });
          console.log(`  ✅ Created image ${j} on slide ${slideId} (fallback, no rounded corners)`);
        } catch (fallbackErr) {
          console.warn(`  ⚠️ Fallback also failed for slide ${slideId}: ${fallbackErr.message}`);
        }
      }
    }
  }

  // Adjust z-order: images should be ABOVE the background shape but BELOW text/icons.
  // Strategy: send each image to back (behind background), then bring forward once
  // so it sits just above the full-slide background shape.
  try {
    const pres = await slides.presentations.get({ presentationId });
    const slide = (pres.data.slides || []).find(s => s.objectId === slideId);
    if (slide) {
      const allElements = slide.pageElements || [];
      // Find our newly created large images
      const newImages = allElements
        .filter(el => el.image)
        .filter(el => {
          const rendered = {
            w: (el.size?.width?.magnitude || 0) * Math.abs(el.transform?.scaleX || 1),
            h: (el.size?.height?.magnitude || 0) * Math.abs(el.transform?.scaleY || 1),
          };
          // Our created images are large (> 2 inches)
          return rendered.w > 2 * EMU_PER_INCH && rendered.h > 2 * EMU_PER_INCH;
        });

      if (newImages.length > 0) {
        // Step 1: Send each image to the very back
        for (const img of newImages) {
          await slides.presentations.batchUpdate({
            presentationId,
            requestBody: { requests: [{
              updatePageElementsZOrder: {
                pageElementObjectIds: [img.objectId],
                operation: 'SEND_TO_BACK',
              },
            }] },
          });
        }
        // Step 2: Bring each image forward once (above background shape, below everything else)
        for (const img of newImages) {
          await slides.presentations.batchUpdate({
            presentationId,
            requestBody: { requests: [{
              updatePageElementsZOrder: {
                pageElementObjectIds: [img.objectId],
                operation: 'BRING_FORWARD',
              },
            }] },
          });
        }
        console.log(`  Z-ordered ${newImages.length} images: above background, below text on slide ${slideId}`);
      }
    }
  } catch (zErr) {
    console.warn(`  ⚠️ Z-order adjustment failed: ${zErr.message}`);
  }

  return tempFileIds;
}

/**
 * Prepare product images: download from original URLs and upload to Google Drive.
 * Returns array of { url, fileId } for use in replaceImage, plus cleanup list.
 */
/**
 * Prepare product images for use in Google Slides replaceImage API.
 * Strategy:
 *   1. Try original URLs directly (works if publicly accessible from Google servers)
 *   2. If original URLs fail, proxy through Google Drive
 *
 * Returns array of URLs to try, plus cleanup list for temp Drive files.
 */
async function prepareProductImages(drive, product, maxImages = 2) {
  const validImages = (product.images || [])
    .filter(url => url && typeof url === 'string' && /^https?:\/\/.+/.test(url.trim()));

  if (validImages.length === 0) {
    console.log(`  No valid images for product: ${product.product_name}`);
    return { primaryUrls: [], fallbackUrls: [], tempFileIds: [] };
  }

  // Pick images from the END of the array:
  //   - Big image (top placeholder)  = second-to-last
  //   - Small image (bottom placeholder) = last
  let selected;
  if (validImages.length >= 2) {
    selected = [
      validImages[validImages.length - 2],  // second-to-last → big image
      validImages[validImages.length - 1],  // last → small image
    ];
  } else {
    // Only 1 image: use it for both slots
    selected = [validImages[0], validImages[0]];
  }

  console.log(`  Prepared ${selected.length} image URL(s) for product: ${product.product_name} (from ${validImages.length} total)`);
  return { primaryUrls: selected, fallbackUrls: [], tempFileIds: [] };
}

/**
 * Build placeholder map from product data
 */
/**
 * Extract only numeric value from a string. Returns '0' if no number found.
 */
function extractNumber(str) {
  if (!str) return '0';
  const match = String(str).replace(/,/g, '').match(/[\d.]+/);
  return match ? match[0] : '0';
}

function extractSpotsPerDay(str) {
  if (!str) return '0';
  const normalized = String(str).replace(/,/g, '').replace(/\./g, '');
  const dayMatch = normalized.match(/([\d]+(?:\.\d+)?)\s*(?:spots?|suất|lần)?\s*\/?\s*(?:day|ngày)/i);
  if (dayMatch) return dayMatch[1];
  return extractNumber(str);
}

function formatCurrencyValue(value, currency = 'VND') {
  if (!value) return '';

  const normalizedCurrency = String(currency || 'VND').toUpperCase();
  const symbol = normalizedCurrency === 'VND' ? 'VNĐ' : normalizedCurrency;
  const formattedNumber = Number(value).toLocaleString('vi-VN');

  return normalizedCurrency === 'VND'
    ? `${formattedNumber} ${symbol}`
    : `${symbol} ${formattedNumber}`;
}

function formatMediaType(type) {
  const labels = {
    led: 'LED screens',
    digital: 'Digital screens',
    billboard: 'Billboard',
    transit: 'Transit media',
    poster: 'Poster',
    banner: 'Banner',
    other: 'OOH media',
  };

  return labels[type] || '';
}

async function keepOnlyProductTemplateSlide(slides, presentationId) {
  const presentation = await slides.presentations.get({ presentationId });
  const allSlides = presentation.data.slides || [];
  const productSlide = allSlides[0];
  const sampleSlideIds = allSlides.slice(1).map(slide => slide.objectId).filter(Boolean);

  if (sampleSlideIds.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: sampleSlideIds.map(objectId => ({ deleteObject: { objectId } })),
      },
    });
    console.log(`Removed ${sampleSlideIds.length} sample/reference slide(s) from export`);
  }

  return productSlide?.objectId;
}

/**
 * Translate common Vietnamese terms to English for PPT export
 */
function translateToEnglish(text) {
  if (!text) return '';
  let result = String(text);

  const replacements = [
    // Time periods
    [/(\d+)\s*tháng/gi, '$1 month'],
    [/(\d+)\s*năm/gi, '$1 year'],
    [/(\d+)\s*tuần/gi, '$1 week'],
    [/(\d+)\s*ngày/gi, '$1 day'],
    // Administrative units
    [/\bQuận\b/g, 'Dist.'],
    [/\bPhường\b/g, 'Ward'],
    [/\bThành phố\b/g, 'City'],
    [/\bTỉnh\b/g, 'Province'],
    [/\bHuyện\b/g, 'District'],
    [/\bXã\b/g, 'Commune'],
    [/\bThị xã\b/g, 'Town'],
    [/\bĐường\b/g, 'St.'],
    // Directions & landmarks
    [/\bHướng nhìn\b/gi, 'Facing'],
    [/\bNgã tư\b/gi, 'intersection'],
    [/\bNgã ba\b/gi, 'T-junction'],
    [/\bVòng xoay\b/gi, 'roundabout'],
    [/\bCầu vượt\b/gi, 'overpass'],
    [/\bTrung tâm\b/gi, 'center'],
    [/\bGần\b/gi, 'Near'],
    [/\bgần\b/g, 'near'],
    // Advertising/billboard terms
    [/\bBảng quảng cáo\b/gi, 'Billboard'],
    [/\bMàn hình\b/gi, 'Screen'],
    [/\bVị trí\b/gi, 'Location'],
    [/\bKhu vực\b/gi, 'Area'],
    // Description terms
    [/\bnằm\b/gi, 'located'],
    [/\btuyến đường\b/gi, 'route'],
    [/\bhuyết mạch\b/gi, 'arterial road'],
    [/\bcơ sở\b/gi, 'facilities'],
    [/\bkhách quốc tế\b/gi, 'international tourists'],
    [/\bsân bay\b/gi, 'airport'],
    [/\btập trung\b/gi, 'concentrated'],
    [/\blưu trú\b/gi, 'accommodation'],
    [/\bkhúc đường cong\b/gi, 'curved road section'],
    [/\btrên đường\b/gi, 'on'],
    // Traffic terms
    [/lượt\/ngày/gi, 'views/day'],
    [/xe\/ngày/gi, 'vehicles/day'],
    [/người\/ngày/gi, 'pedestrians/day'],
  ];

  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  // Clean up multiple spaces
  result = result.replace(/\s{2,}/g, ' ').trim();
  return result;
}

function buildPlaceholderMap(product) {
  const attrs = product.attributes || {};
  
  // Truncate product name to max 40 chars (including spaces)
  const productName = (product.product_name || '').slice(0, 40);

  // Format dimension
  const dimension = (attrs.width && attrs.height) 
    ? `${attrs.width}m W x ${attrs.height}mH` 
    : '';
  
  // Format resolution
  const resolution = (attrs.pixel_width && attrs.pixel_height) 
    ? `${attrs.pixel_width} x ${attrs.pixel_height} px` 
    : '';
  
  // Format operating time
  const operaTime = (attrs.opera_time_from && attrs.opera_time_to)
    ? `from ${attrs.opera_time_from} - ${attrs.opera_time_to}`
    : '';
  
  // Format cost
  const currency = product.currency || 'VND';
  const costFormatted = formatCurrencyValue(product.cost, currency);
  
  // Translate booking_duration to English (use actual data, no hardcoded default)
  const bookingDurationEn = translateToEnglish(product.booking_duration || '');

  // Format cost with period
  const costWithPeriod = costFormatted && bookingDurationEn
    ? `${costFormatted} / ${bookingDurationEn}` 
    : costFormatted;

  // Format GPS
  const gps = product.gps_coordinates 
    || ((product.latitude && product.longitude) ? `${product.latitude}, ${product.longitude}` : '');

  // Format video duration
  const videoDuration = attrs.video_duration 
    ? `${attrs.video_duration}s` 
    : '';

  // Format frequency with time
  const frequencyFull = [attrs.frequency || '', operaTime].filter(Boolean).join(',\n');

  // Format type/format
  const formatLabel = formatMediaType(product.type);

  const ledCount = attrs.quantity_of_ad || attrs.add_side || '';
  const unitCount = ledCount ? String(ledCount).padStart(2, '0') : '';
  const quantityFaces = ledCount ? `${ledCount} face` : '';

  const traffic = product.traffic ? String(product.traffic).trim().split('/')[0] : '';

  // Local tax
  const localTax = product.local_tax 
    ? `Local tax: ${product.local_tax}% not included` 
    : '';

  // Near by / landmark (translated to English)
  const landmark = translateToEnglish(product.landmark || '');

  // Parse note field — may contain "Minimum Booking: X" mixed with visibility info
  const rawNote = attrs.note || '';
  const minBookingMatch = rawNote.match(/Minimum\s*Booking[:\s]*(.+)/i);
  const minBookingFromNote = minBookingMatch ? translateToEnglish(minBookingMatch[1].trim()) : '';
  // Visibility = note text WITHOUT the "Minimum Booking" part
  const noteWithoutBooking = rawNote.replace(/Minimum\s*Booking[:\s]*.*/i, '').trim();
  const visibility = translateToEnglish(noteWithoutBooking) || 'Good and head on advertisement';

  // Booking minimum: prefer value from note, fallback to booking_duration
  const bookingMinimum = minBookingFromNote || bookingDurationEn;

  // Description - max 200 chars (translated to English)
  const descriptionSource = product.description
    || [product.product_name, product.landmark, product.location_address].filter(Boolean).join('. ');
  const description = translateToEnglish(descriptionSource.slice(0, 220));

  // City province (translated to English)
  const cityProvince = translateToEnglish(product.city_province || '');

  // Provider
  const providerName = product.provider_name || '';

  // Full address (translated to English)
  const address = translateToEnglish(product.location_address || '');

  // Booking duration (translated to English)
  const bookingDuration = bookingDurationEn;

  // Spots per day - extract only number from frequency
  const spotsDay = extractSpotsPerDay(attrs.frequency);

  const map = {
    // Double-brace format {{key}}
    '{{product_name}}': productName,
    '{{product_code}}': product.product_code || '',
    '{{led_count}}': String(ledCount),
    '{{unit_count}}': unitCount,
    '{{quantity_faces}}': quantityFaces,
    '{{traffic}}': traffic,
    '{{frequency}}': frequencyFull,
    '{{spots_day}}': spotsDay,
    '{{description}}': description,
    '{{landmark}}': landmark,
    '{{visibility}}': visibility,
    '{{address}}': address,
    '{{format}}': formatLabel,
    '{{dimension}}': dimension,
    '{{resolution}}': resolution,
    '{{gps}}': gps,
    '{{video_duration}}': videoDuration || "",
    '{{opera_time}}': operaTime,
    '{{cost}}': costFormatted,
    '{{cost_with_period}}': costWithPeriod,
    '{{booking_duration}}': bookingDuration,
    '{{local_tax}}': localTax,
    '{{city_province}}': cityProvince,
    '{{provider_name}}': providerName,
    '{{currency}}': currency,
    '{{Near By}}': "",
    '{{Booking minimum}}': bookingMinimum,
    
    // Single-brace format {key} — matching template in screenshot
    '{product_name}': productName,
    '{product_code}': product.product_code || '',
    '{location_name}': (product.location_name || product.product_name || '').slice(0, 40),
    '{location_address}': address,
    '{type}': formatLabel,
    '{attributes.width}': attrs.width ? `${attrs.width}m W` : '',
    '{attributes.height}': attrs.height ? `${attrs.height}mH` : '',
    '{attributes.ad_side}': String(attrs.add_side || 1),
    '{attributes.video_duration}': attrs.video_duration ? String(attrs.video_duration) : '',
    '{attributes.pixel_width}': attrs.pixel_width ? String(attrs.pixel_width) : '',
    '{attributes.pixel_height}': attrs.pixel_height ? String(attrs.pixel_height) : '',
    '{attributes.quantity_of_ad}': String(ledCount),
    '{quantity of ad face}': String(ledCount),
    '{quantity_faces}': quantityFaces,
    '{frequency}': spotsDay,
    '{traffic}': traffic,
    '{cost}': costWithPeriod,
    '{booking_duration}': bookingDuration || '',
    '{description}': description,
    '{landmark}': landmark,
    '{gps}': gps,
    '{local_tax}': localTax,
    '{city_province}': cityProvince,
    '{currency}': currency,
    '{opera_time_from}': attrs.opera_time_from || '',
    '{opera_time_to}': attrs.opera_time_to || '',
    '{attributes.note}': attrs.note || '',
  };

  // Replace empty string values with a single space so placeholder tags
  // are cleared from the slide instead of remaining visible.
  for (const key of Object.keys(map)) {
    if (map[key] === '' || map[key] === '0') {
      map[key] = ' ';
    }
  }

  return map;
}

/**
 * Export a single product to Google Slides by copying template and replacing placeholders
 * Returns the URL of the new presentation
 */
export async function exportProductToSlides(product) {
  const auth = await getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const slides = google.slides({ version: 'v1', auth });

  // 1. Copy the template
  const fileName = `${product.product_name || 'Product'} - G2B Media`;
  const copyResponse = await drive.files.copy({
    fileId: TEMPLATE_SLIDE_ID,
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
    },
  });
  
  const newPresentationId = copyResponse.data.id;
  console.log(`Created presentation copy: ${newPresentationId}`);

  const slideId = await keepOnlyProductTemplateSlide(slides, newPresentationId);
  if (!slideId) {
    throw new Error('Template does not contain a product slide');
  }

  // 2. Build placeholder replacements
  const placeholderMap = buildPlaceholderMap(product);

  // 3. Build batch update requests for text replacement
  const requests = [];
  
  for (const [placeholder, value] of Object.entries(placeholderMap)) {
    requests.push({
      replaceAllText: {
        containsText: {
          text: placeholder,
          matchCase: true,
        },
        replaceText: value,
      },
    });
  }

  // 4. Execute text replacement batch update
  if (requests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId: newPresentationId,
      requestBody: { requests },
    });
    console.log(`Applied ${requests.length} text replacements`);
  }

  // 5. Handle image insertion — insert up to 2 images at predefined positions
  const { primaryUrls, tempFileIds } = await prepareProductImages(drive, product, 2);
  const imagesToUse = primaryUrls.length > 0
    ? primaryUrls
    : [PLACEHOLDER_IMAGE_URL, PLACEHOLDER_IMAGE_URL];

  const insertTempIds = await insertImagesOnSlide(slides, drive, newPresentationId, slideId, imagesToUse);
  tempFileIds.push(...insertTempIds);

  // 6. Make the file accessible (anyone with link can view)
  await drive.permissions.create({
    fileId: newPresentationId,
    supportsAllDrives: true,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // 7. Delayed cleanup — give Google time to fully embed images before deleting source files
  if (tempFileIds.length > 0) {
    console.log(`Scheduling cleanup of ${tempFileIds.length} temp Drive files in 60 s...`);
    const cleanupTimer = setTimeout(() => {
      cleanupDriveFiles(drive, tempFileIds).catch(() => {});
    }, 60000);
    cleanupTimer.unref?.();
  }

  const slideUrl = `https://docs.google.com/presentation/d/${newPresentationId}/edit`;
  const exportUrl = `https://docs.google.com/presentation/d/${newPresentationId}/export/pptx`;

  return {
    presentationId: newPresentationId,
    slideUrl,
    exportUrl,
    fileName,
  };
}

/**
 * Export multiple products - one slide per product
 * Creates a single presentation with multiple slides.
 *
 * Key fix: duplicate the product template slide BEFORE any text replacement so that every
 * copy still contains the original {{placeholder}} tokens.
 */
export async function exportMultipleProductsToSlides(products) {
  const auth = await getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const slides = google.slides({ version: 'v1', auth });

  if (!products || products.length === 0) {
    throw new Error('No products to export');
  }

  // For single product, use the simple approach
  if (products.length === 1) {
    return exportProductToSlides(products[0]);
  }

  // 1. Copy the template — all slides still have original placeholders
  const fileName = `G2B Media - ${products.length} Products Export`;
  const copyResponse = await drive.files.copy({
    fileId: TEMPLATE_SLIDE_ID,
    supportsAllDrives: true,
    requestBody: { name: fileName },
  });
  const presentationId = copyResponse.data.id;
  console.log(`Created presentation copy: ${presentationId}`);

  // 2. Keep only the first slide as the clean product template.
  const productTemplateSlideId = await keepOnlyProductTemplateSlide(slides, presentationId);
  if (!productTemplateSlideId) {
    throw new Error('Template does not contain a product slide');
  }
  const originalSlideIds = [productTemplateSlideId];
  console.log(`Using product template slide: ${productTemplateSlideId}`);

  // 3. Duplicate those clean slides N-1 times BEFORE any text replacement
  //    so every duplicate still contains the original placeholder tokens.
  //    productSlideMap[i] = array of slide IDs for product i.
  const productSlideMap = [];
  productSlideMap.push([...originalSlideIds]); // product 0 uses the originals

  for (let i = 1; i < products.length; i++) {
    const dupRequests = originalSlideIds.map(slideId => ({
      duplicateObject: { objectId: slideId },
    }));

    const dupResult = await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: dupRequests },
    });

    const newSlideIds = dupResult.data.replies
      ?.map(r => r.duplicateObject?.objectId)
      .filter(Boolean) || [];

    productSlideMap.push(newSlideIds);
    console.log(`Duplicated slides for product ${i}: ${newSlideIds.join(', ')}`);
  }

  // 4. Apply scoped text replacements per product
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const slideIds = productSlideMap[i];
    const placeholderMap = buildPlaceholderMap(product);

    const replaceRequests = [];
    for (const [placeholder, value] of Object.entries(placeholderMap)) {
      replaceRequests.push({
        replaceAllText: {
          containsText: { text: placeholder, matchCase: true },
          replaceText: value,
          pageObjectIds: slideIds,
        },
      });
    }

    if (replaceRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: replaceRequests },
      });
      console.log(`Applied text replacements for product ${i}: ${product.product_name}`);
    }
  }

  // 5. Insert images per product using createImage API
  const allTempFileIds = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const slideIds = productSlideMap[i];

    const { primaryUrls, tempFileIds } = await prepareProductImages(drive, product, 2);
    allTempFileIds.push(...tempFileIds);

    const imagesToUse = primaryUrls.length > 0
      ? primaryUrls
      : [PLACEHOLDER_IMAGE_URL, PLACEHOLDER_IMAGE_URL];

    // Insert images on the first slide of this product's slide set
    const slideId = slideIds[0];
    if (slideId) {
      const insertTempIds = await insertImagesOnSlide(slides, drive, presentationId, slideId, imagesToUse);
      allTempFileIds.push(...insertTempIds);
    }
  }

  // 6. Make the presentation publicly accessible
  await drive.permissions.create({
    fileId: presentationId,
    supportsAllDrives: true,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  // 7. Delayed cleanup — give Google time to fully embed images before deleting source files
  if (allTempFileIds.length > 0) {
    console.log(`Scheduling cleanup of ${allTempFileIds.length} temp Drive files in 60 s...`);
    const cleanupTimer = setTimeout(() => {
      cleanupDriveFiles(drive, allTempFileIds).catch(() => {});
    }, 60000);
    cleanupTimer.unref?.();
  }

  const slideUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
  const exportUrl = `https://docs.google.com/presentation/d/${presentationId}/export/pptx`;

  return {
    presentationId,
    slideUrl,
    exportUrl,
    fileName,
    productCount: products.length,
  };
}

/**
 * Download a presentation as PPTX binary using Drive API export
 * Returns a readable stream
 */
export async function downloadPresentationAsPptx(presentationId) {
  const auth = await getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  // Get file name
  const fileMeta = await drive.files.get({
    fileId: presentationId,
    supportsAllDrives: true,
    fields: 'name',
  });

  const fileName = fileMeta.data.name || 'export';

  // Export as PPTX
  const response = await drive.files.export({
    fileId: presentationId,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }, {
    responseType: 'stream',
  });

  return { stream: response.data, fileName };
}

/**
 * Download a presentation as PDF binary using Drive API export
 * Returns a readable stream
 */
export async function downloadPresentationAsPdf(presentationId) {
  const auth = await getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const fileMeta = await drive.files.get({
    fileId: presentationId,
    supportsAllDrives: true,
    fields: 'name',
  });

  const fileName = fileMeta.data.name || 'export';

  const response = await drive.files.export({
    fileId: presentationId,
    mimeType: 'application/pdf',
  }, {
    responseType: 'stream',
  });

  return { stream: response.data, fileName };
}

/**
 * Inspect template slide — returns all page elements with their types, positions, and sizes.
 * Used for debugging image placeholder detection.
 */
export async function inspectTemplate() {
  const auth = await getAuthClient();
  const slides = google.slides({ version: 'v1', auth });

  const presentation = await slides.presentations.get({
    presentationId: TEMPLATE_SLIDE_ID,
  });

  const slide = presentation.data.slides[0];
  const pageElements = slide.pageElements || [];

  return pageElements.map((el, idx) => {
    const t = el.transform || {};
    const sizeW = el.size?.width?.magnitude || 0;
    const sizeH = el.size?.height?.magnitude || 0;
    const renderedW = sizeW * Math.abs(t.scaleX || 1);
    const renderedH = sizeH * Math.abs(t.scaleY || 1);

    return {
      index: idx,
      objectId: el.objectId,
      type: el.image ? 'IMAGE' : el.shape ? 'SHAPE' : el.table ? 'TABLE' : el.elementGroup ? 'GROUP' : 'OTHER',
      transform: {
        translateX: t.translateX || 0,
        translateY: t.translateY || 0,
        scaleX: t.scaleX || 1,
        scaleY: t.scaleY || 1,
        unit: t.unit || 'EMU',
      },
      size: { width: sizeW, height: sizeH },
      rendered: { width: Math.round(renderedW), height: Math.round(renderedH) },
      renderedInches: {
        width: (renderedW / 914400).toFixed(2),
        height: (renderedH / 914400).toFixed(2),
      },
      positionInches: {
        x: ((t.translateX || 0) / 914400).toFixed(2),
        y: ((t.translateY || 0) / 914400).toFixed(2),
      },
      imageUrl: el.image?.contentUrl ? el.image.contentUrl.substring(0, 80) + '...' : null,
    };
  });
}
