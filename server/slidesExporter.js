import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template Slide ID
const TEMPLATE_SLIDE_ID = process.env.GOOGLE_SLIDES_TEMPLATE_ID || '1OljbL0izqkxUcg2VyDHIWbyMw9vK0qmLNBvNqwBxOSw';

// Placeholder image for products without photos
// A simple grey image with "No Image" text, hosted on a reliable public CDN
const PLACEHOLDER_IMAGE_URL = process.env.PLACEHOLDER_IMAGE_URL || 'https://placehold.co/800x600/e2e8f0/64748b?text=No+Image+Available';

// Scopes for Google Slides & Drive
const SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
];

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

/**
 * Upload an image from a URL to Google Drive so Google Slides can access it.
 * Returns a publicly accessible Google Drive content URL.
 * This solves the problem where self-hosted Supabase URLs are not reachable by Google servers.
 */
async function proxyImageToDrive(drive, imageUrl) {
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
    const buffer = Buffer.from(await response.arrayBuffer());
    
    if (buffer.length < 100) {
      console.warn(`⚠️ Image too small (${buffer.length} bytes), likely broken: ${imageUrl}`);
      return null;
    }

    // Upload to Google Drive
    const fileMetadata = {
      name: `g2b-export-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.jpg`,
      mimeType: contentType,
    };

    const media = {
      mimeType: contentType,
      body: Readable.from(buffer),
    };

    const driveFile = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, webContentLink',
    });

    const fileId = driveFile.data.id;

    // Make the file publicly readable
    await drive.permissions.create({
      fileId,
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
  const costFormatted = product.cost 
    ? `${currency} ${Number(product.cost).toLocaleString('en-US')}` 
    : '';
  
  // Translate booking_duration to English
  const bookingDurationEn = translateToEnglish(product.booking_duration || '1 month');

  // Format cost with period
  const costWithPeriod = costFormatted 
    ? `${costFormatted} / ${bookingDurationEn}` 
    : '';

  // Format GPS
  const gps = product.gps_coordinates 
    || ((product.latitude && product.longitude) ? `${product.latitude}, ${product.longitude}` : '');

  // Format video duration
  const videoDuration = attrs.video_duration 
    ? `${attrs.video_duration}s duration` 
    : '';

  // Format frequency with time
  const frequencyFull = attrs.frequency 
    ? `${attrs.frequency} spots/day,\n${operaTime}` 
    : '';

  // Format type/format
  const formatLabel = product.type 
    ? product.type.charAt(0).toUpperCase() + product.type.slice(1) + ' screens' 
    : '';

  // LED count  
  const ledCount = attrs.quantity_of_ad || '';

  // Traffic - truncate to 3 chars for slide layout
  const traffic = product.traffic ? String(product.traffic).slice(0, 3) : '';

  // Local tax
  const localTax = product.local_tax 
    ? `Local tax: ${product.local_tax}% not included` 
    : '';

  // Near by / landmark (translated to English)
  const landmark = translateToEnglish(product.landmark || '');

  // Visibility from note (translated to English)
  const visibility = translateToEnglish(attrs.note || '');

  // Description - max 200 chars (translated to English)
  const description = translateToEnglish((product.description || '').slice(0, 200));

  // City province (translated to English)
  const cityProvince = translateToEnglish(product.city_province || '');

  // Provider
  const providerName = product.provider_name || '';

  // Full address (translated to English)
  const address = translateToEnglish(product.location_address || '');

  // Booking duration (translated to English)
  const bookingDuration = bookingDurationEn;

  // Spots per day - extract only number from frequency
  const spotsDay = extractNumber(attrs.frequency);

  return {
    // Double-brace format {{key}}
    '{{product_name}}': productName,
    '{{product_code}}': product.product_code || '',
    '{{led_count}}': String(ledCount),
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
    '{{video_duration}}': videoDuration,
    '{{opera_time}}': operaTime,
    '{{cost}}': costFormatted,
    '{{cost_with_period}}': costWithPeriod,
    '{{booking_duration}}': bookingDuration,
    '{{local_tax}}': localTax,
    '{{city_province}}': cityProvince,
    '{{provider_name}}': providerName,
    '{{currency}}': currency,
    
    // Single-brace format {key} — matching template in screenshot
    '{product_name}': productName,
    '{product_code}': product.product_code || '',
    '{location_name}': (product.location_name || product.product_name || '').slice(0, 40),
    '{location_address}': address,
    '{type}': formatLabel,
    '{attributes.width}': attrs.width ? `${attrs.width}m W` : '',
    '{attributes.height}': attrs.height ? `${attrs.height}mH` : '',
    '{attributes.ad_side}': String(attrs.add_side || 1),
    '{attributes.video_duration}': attrs.video_duration ? `${attrs.video_duration}s duration,` : '',
    '{attributes.pixel_width}': attrs.pixel_width ? String(attrs.pixel_width) : '',
    '{attributes.pixel_height}': attrs.pixel_height ? String(attrs.pixel_height) : '',
    '{attributes.quantity_of_ad}': String(ledCount),
    '{frequency}': spotsDay,
    '{traffic}': traffic,
    '{cost}': costFormatted,
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

  // 5. Handle image replacements — only use first 2 images
  // Template has exactly 2 large photo areas on the right side, identified by inspection:
  //   - Top-right hero: objectId "g3d25dc2f435_0_4" (5.49" x 3.56" at x=5.11", y=-0.67")
  //   - Bottom-right feature: objectId "g3d25dc2f435_0_6" (5.37" x 3.79" at x=5.22", y=1.80")
  // We use known objectIds as primary strategy, with dynamic fallback.
  const KNOWN_IMAGE_IDS = ['g3d25dc2f435_0_4', 'g3d25dc2f435_0_6'];
  
  // Prepare image URLs — use original Supabase URLs directly (publicly accessible)
  const { primaryUrls, tempFileIds } = await prepareProductImages(drive, product, 2);

  // Use original images, or placeholder if none available
  const imagesToUse = primaryUrls.length > 0 
    ? primaryUrls 
    : [PLACEHOLDER_IMAGE_URL, PLACEHOLDER_IMAGE_URL];

  {
    const presentation = await slides.presentations.get({
      presentationId: newPresentationId,
    });
    const slide = presentation.data.slides[0];
    const pageElements = slide.pageElements || [];

    // Strategy 1: Find by known objectIds from the template
    let imagePlaceholders = KNOWN_IMAGE_IDS
      .map(id => pageElements.find(el => el.objectId === id && el.image))
      .filter(Boolean);

    // Strategy 2: If known IDs not found (e.g. after duplication), detect dynamically
    if (imagePlaceholders.length < 2) {
      console.log('Known image IDs not found, using dynamic detection...');
      
      // Calculate rendered size: size * |scale|
      function getRenderedSize(el) {
        const w = (el.size?.width?.magnitude || 0) * Math.abs(el.transform?.scaleX || 1);
        const h = (el.size?.height?.magnitude || 0) * Math.abs(el.transform?.scaleY || 1);
        return { width: w, height: h };
      }

      // Large photos: rendered > 3 inches in both dimensions, on right half
      const MIN_EMU = 2743200; // 3 inches in EMU
      imagePlaceholders = pageElements
        .filter(el => {
          if (!el.image) return false;
          const tx = el.transform?.translateX || 0;
          const rendered = getRenderedSize(el);
          return tx > 3500000 && rendered.width > MIN_EMU && rendered.height > MIN_EMU;
        })
        .sort((a, b) => {
          const ay = a.transform?.translateY || 0;
          const by = b.transform?.translateY || 0;
          return ay - by;
        })
        .slice(0, 2);
    }

    console.log(`Found ${imagePlaceholders.length} image placeholders for replacement`);
    imagePlaceholders.forEach((el, i) => {
      const t = el.transform || {};
      console.log(`  Placeholder[${i}] id=${el.objectId} tX=${t.translateX} tY=${t.translateY}`);
    });

    const imageRequests = [];
    for (let i = 0; i < Math.min(imagePlaceholders.length, imagesToUse.length); i++) {
      const imageUrl = imagesToUse[i];
      if (!imageUrl) continue;

      imageRequests.push({
        replaceImage: {
          imageObjectId: imagePlaceholders[i].objectId,
          url: imageUrl,
          imageReplaceMethod: 'CENTER_CROP',
        },
      });
    }

    if (imageRequests.length > 0) {
      const placeholderIds = imagePlaceholders.map(p => p.objectId);

      // Try replacing images; handle failures gracefully
      try {
        await slides.presentations.batchUpdate({
          presentationId: newPresentationId,
          requestBody: { requests: imageRequests },
        });
        console.log(`Replaced ${imageRequests.length} images`);
      } catch (imgErr) {
        console.warn(`⚠️ Batch image replace failed: ${imgErr.message}`);
        
        // Retry one by one — if original URL fails, try proxying through Drive
        for (let ri = 0; ri < imageRequests.length; ri++) {
          const req = imageRequests[ri];
          const objectId = req.replaceImage.imageObjectId;

          try {
            await slides.presentations.batchUpdate({
              presentationId: newPresentationId,
              requestBody: { requests: [req] },
            });
            console.log(`✅ Replaced image ${objectId}`);
          } catch (singleErr) {
            console.warn(`⚠️ Direct URL failed for ${objectId}: ${singleErr.message}`);
            // Fallback: proxy through Google Drive
            const proxied = await proxyImageToDrive(drive, req.replaceImage.url);
            if (proxied) {
              tempFileIds.push(proxied.fileId);
              try {
                await slides.presentations.batchUpdate({
                  presentationId: newPresentationId,
                  requestBody: { requests: [{
                    replaceImage: { imageObjectId: objectId, url: proxied.url, imageReplaceMethod: 'CENTER_CROP' },
                  }] },
                });
                console.log(`✅ Replaced image ${objectId} via Drive proxy`);
              } catch (proxyErr) {
                console.warn(`⚠️ Drive proxy also failed for ${objectId}: ${proxyErr.message}`);
              }
            }
          }
        }
      }

      // 5b. Re-fetch presentation to get updated element data after replaceImage
      const updatedPres = await slides.presentations.get({ presentationId: newPresentationId });
      const updatedPage = updatedPres.data.slides?.[0];
      const updatedElements = updatedPage?.pageElements || [];

      // Target sizes in EMU (1 inch = 914400 EMU)
      // Slide width = 10" = 9144000 EMU, right margin = 0.2"
      const EMU_PER_INCH = 914400;
      const SLIDE_WIDTH = 10 * EMU_PER_INCH;
      const RIGHT_MARGIN = 0.4 * EMU_PER_INCH; // 0.4" from right edge
      const targetSizes = {
        'g3d25dc2f435_0_4': { w: 4.2 * EMU_PER_INCH, h: 2.3 * EMU_PER_INCH, topOffset: 0.3 * EMU_PER_INCH },  // Image 1 + push down 0.3"
        'g3d25dc2f435_0_6': { w: 2.2 * EMU_PER_INCH, h: 1.5 * EMU_PER_INCH, topOffset: 0 },  // Image 2
      };
      const resizeRequests = [];

      for (const id of placeholderIds) {
        const target = targetSizes[id];
        if (!target) continue;

        const el = updatedElements.find(e => e.objectId === id);
        if (!el) { console.log(`  Element ${id} not found after replace`); continue; }

        const t = el.transform || {};
        const sizeW = el.size?.width?.magnitude || 0;
        const sizeH = el.size?.height?.magnitude || 0;
        const oldSX = t.scaleX || 1;
        const oldSY = t.scaleY || 1;
        const oldTX = t.translateX || 0;
        const oldTY = t.translateY || 0;

        // Current rendered dimensions (after replaceImage)
        const renderedW = sizeW * Math.abs(oldSX);
        const renderedH = sizeH * Math.abs(oldSY);

        // Skip if size is 0 to avoid Infinity scaling
        if (sizeW === 0 || sizeH === 0) {
          console.log(`  Skipping resize for ${id}: element size is 0`);
          continue;
        }

        // New scale to achieve exact target size
        const newSX = (target.w / sizeW) * Math.sign(oldSX || 1);
        const newSY = (target.h / sizeH) * Math.sign(oldSY || 1);

        // Position: right-edge aligned with margin, vertically centered + optional top offset
        const newTX = SLIDE_WIDTH - RIGHT_MARGIN - target.w; // flush to right margin
        const deltaH = renderedH - target.h;
        const newTY = oldTY + deltaH / 2 + (target.topOffset || 0);

        console.log(`  Resize ${id}: ${(renderedW/EMU_PER_INCH).toFixed(2)}" x ${(renderedH/EMU_PER_INCH).toFixed(2)}" → ${(target.w/EMU_PER_INCH).toFixed(2)}" x ${(target.h/EMU_PER_INCH).toFixed(2)}"`);

        resizeRequests.push({
          updatePageElementTransform: {
            objectId: id,
            applyMode: 'ABSOLUTE',
            transform: {
              scaleX: newSX,
              scaleY: newSY,
              translateX: newTX,
              translateY: newTY,
              shearX: t.shearX || 0,
              shearY: t.shearY || 0,
              unit: 'EMU',
            },
          },
        });
      }

      if (resizeRequests.length > 0) {
        await slides.presentations.batchUpdate({
          presentationId: newPresentationId,
          requestBody: { requests: resizeRequests },
        });
        console.log(`Resized ${resizeRequests.length} images to exact target sizes`);
      }
    }
  }

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
    setTimeout(() => {
      cleanupDriveFiles(drive, tempFileIds).catch(() => {});
    }, 60000);
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
 * Key fix: duplicate all slides BEFORE any text replacement so that every
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

  // 2. Read the initial (clean) slides
  const initialPres = await slides.presentations.get({ presentationId });
  const originalSlideIds = (initialPres.data.slides || []).map(s => s.objectId);
  console.log(`Template has ${originalSlideIds.length} slide(s)`);

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

  // 5. Replace images per product with proper detection + resize
  const allTempFileIds = [];

  // Helper to calculate rendered size of an element
  function getRenderedSize(el) {
    const w = (el.size?.width?.magnitude || 0) * Math.abs(el.transform?.scaleX || 1);
    const h = (el.size?.height?.magnitude || 0) * Math.abs(el.transform?.scaleY || 1);
    return { width: w, height: h };
  }

  const EMU_PER_INCH = 914400;
  const MIN_EMU = 2743200; // 3 inches in EMU
  const SLIDE_WIDTH = 10 * EMU_PER_INCH;
  const RIGHT_MARGIN = 0.4 * EMU_PER_INCH;

  // Target sizes by position index (0 = top/big, 1 = bottom/small)
  // Must match the single-product export resize targets
  const TARGET_SIZES = [
    { w: 4.2 * EMU_PER_INCH, h: 2.3 * EMU_PER_INCH, topOffset: 0.3 * EMU_PER_INCH },
    { w: 2.2 * EMU_PER_INCH, h: 1.5 * EMU_PER_INCH, topOffset: 0 },
  ];

  // Fetch presentation once to get all element IDs before replacements
  const preImagePres = await slides.presentations.get({ presentationId });
  const preImageSlides = preImagePres.data.slides || [];

  const allReplacedImages = []; // Track { slideId, objectId, positionIndex } for resize step

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const slideIds = productSlideMap[i];

    const { primaryUrls, tempFileIds } = await prepareProductImages(drive, product, 2);
    allTempFileIds.push(...tempFileIds);

    const imagesToUse = primaryUrls.length > 0
      ? primaryUrls
      : [PLACEHOLDER_IMAGE_URL, PLACEHOLDER_IMAGE_URL];

    for (const slideId of slideIds) {
      const slide = preImageSlides.find(s => s.objectId === slideId);
      if (!slide) continue;

      // Find large image elements on the right side of the slide
      // (same detection logic as single-product export)
      let imageElements = (slide.pageElements || [])
        .filter(el => {
          if (!el.image) return false;
          const tx = el.transform?.translateX || 0;
          const rendered = getRenderedSize(el);
          return tx > 3500000 && rendered.width > MIN_EMU && rendered.height > MIN_EMU;
        })
        .sort((a, b) => (a.transform?.translateY || 0) - (b.transform?.translateY || 0))
        .slice(0, 2);

      // Fallback: if no large right-side images found, use any images
      if (imageElements.length === 0) {
        console.log(`  No large right-side images on slide ${slideId}, falling back to all images`);
        imageElements = (slide.pageElements || [])
          .filter(el => el.image)
          .sort((a, b) => (a.transform?.translateY || 0) - (b.transform?.translateY || 0))
          .slice(0, 2);
      }

      console.log(`  Found ${imageElements.length} image placeholders on slide ${slideId}`);

      for (let j = 0; j < Math.min(imageElements.length, imagesToUse.length); j++) {
        const imgUrl = imagesToUse[j];
        if (!imgUrl) continue;
        const objectId = imageElements[j].objectId;

        try {
          await slides.presentations.batchUpdate({
            presentationId,
            requestBody: { requests: [{
              replaceImage: {
                imageObjectId: objectId,
                url: imgUrl,
                imageReplaceMethod: 'CENTER_CROP',
              },
            }] },
          });
          allReplacedImages.push({ slideId, objectId, positionIndex: j });
          console.log(`  Replaced image ${j} on slide ${slideId} (product ${i})`);
        } catch (imgErr) {
          console.warn(`⚠️ Direct URL failed on slide ${slideId}: ${imgErr.message}`);
          // Fallback: proxy through Google Drive
          const proxied = await proxyImageToDrive(drive, imgUrl);
          if (proxied) {
            allTempFileIds.push(proxied.fileId);
            try {
              await slides.presentations.batchUpdate({
                presentationId,
                requestBody: { requests: [{
                  replaceImage: { imageObjectId: objectId, url: proxied.url, imageReplaceMethod: 'CENTER_CROP' },
                }] },
              });
              allReplacedImages.push({ slideId, objectId, positionIndex: j });
              console.log(`  Replaced image ${j} on slide ${slideId} via Drive proxy`);
            } catch (proxyErr) {
              console.warn(`⚠️ Drive proxy also failed for slide ${slideId}: ${proxyErr.message}`);
            }
          }
        }
      }
    }
  }

  // 5b. Resize/reposition all replaced images to exact target sizes
  //     (same logic as single-product export step 5b)
  if (allReplacedImages.length > 0) {
    const updatedPres = await slides.presentations.get({ presentationId });
    const resizeRequests = [];

    for (const { slideId, objectId, positionIndex } of allReplacedImages) {
      const target = TARGET_SIZES[positionIndex];
      if (!target) continue;

      const slide = (updatedPres.data.slides || []).find(s => s.objectId === slideId);
      const el = (slide?.pageElements || []).find(e => e.objectId === objectId);
      if (!el) continue;

      const t = el.transform || {};
      const sizeW = el.size?.width?.magnitude || 0;
      const sizeH = el.size?.height?.magnitude || 0;
      if (sizeW === 0 || sizeH === 0) continue;

      const renderedH = sizeH * Math.abs(t.scaleY || 1);
      const newSX = (target.w / sizeW) * Math.sign(t.scaleX || 1);
      const newSY = (target.h / sizeH) * Math.sign(t.scaleY || 1);
      const newTX = SLIDE_WIDTH - RIGHT_MARGIN - target.w;
      const newTY = (t.translateY || 0) + (renderedH - target.h) / 2 + (target.topOffset || 0);

      resizeRequests.push({
        updatePageElementTransform: {
          objectId,
          applyMode: 'ABSOLUTE',
          transform: {
            scaleX: newSX,
            scaleY: newSY,
            translateX: newTX,
            translateY: newTY,
            shearX: t.shearX || 0,
            shearY: t.shearY || 0,
            unit: 'EMU',
          },
        },
      });
    }

    if (resizeRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: resizeRequests },
      });
      console.log(`Resized ${resizeRequests.length} images across all slides`);
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
    setTimeout(() => {
      cleanupDriveFiles(drive, allTempFileIds).catch(() => {});
    }, 60000);
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
