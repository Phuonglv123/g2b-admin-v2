import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

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

function buildPlaceholderMap(product) {
  const attrs = product.attributes || {};
  
  // Truncate product name to max 40 chars
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
  
  // Format cost with period
  const costWithPeriod = costFormatted 
    ? `${costFormatted} / ${product.booking_duration || '1 month'}` 
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
    ? `${attrs.frequency} sports/day,\n${operaTime}` 
    : '';

  // Format type/format
  const formatLabel = product.type 
    ? product.type.charAt(0).toUpperCase() + product.type.slice(1) + ' screens' 
    : '';

  // LED count  
  const ledCount = attrs.quantity_of_ad || '';

  // Traffic - keep full text as-is for meaningful display
  const traffic = product.traffic ? String(product.traffic) : '';

  // Local tax
  const localTax = product.local_tax 
    ? `Local tax: ${product.local_tax}% not included` 
    : '';

  // Near by / landmark
  const landmark = product.landmark || '';

  // Visibility from note
  const visibility = attrs.note || '';

  // Description - max 200 chars
  const description = (product.description || '').slice(0, 200);

  // City province
  const cityProvince = product.city_province || '';

  // Provider
  const providerName = product.provider_name || '';

  // Full address
  const address = product.location_address || '';

  // Booking duration
  const bookingDuration = product.booking_duration || '';

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
  
  // Filter valid image URLs (must be http/https and not empty)
  const validImages = (product.images || [])
    .filter(url => url && typeof url === 'string' && /^https?:\/\/.+/.test(url.trim()))
    .slice(0, 2);

  // Use placeholder images when product has no valid images
  const imagesToUse = validImages.length > 0 
    ? validImages 
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

      // Try replacing images; handle failures gracefully (e.g. inaccessible URLs)
      try {
        await slides.presentations.batchUpdate({
          presentationId: newPresentationId,
          requestBody: { requests: imageRequests },
        });
        console.log(`Replaced ${imageRequests.length} images`);
      } catch (imgErr) {
        console.warn(`⚠️ Batch image replace failed: ${imgErr.message}`);
        
        // Retry one by one — skip individual failures and try placeholder fallback
        for (const req of imageRequests) {
          try {
            await slides.presentations.batchUpdate({
              presentationId: newPresentationId,
              requestBody: { requests: [req] },
            });
          } catch (singleErr) {
            console.warn(`⚠️ Image replace failed for ${req.replaceImage.imageObjectId}, trying placeholder...`);
            try {
              await slides.presentations.batchUpdate({
                presentationId: newPresentationId,
                requestBody: { requests: [{
                  replaceImage: {
                    ...req.replaceImage,
                    url: PLACEHOLDER_IMAGE_URL,
                  },
                }] },
              });
              console.log(`✅ Used placeholder for ${req.replaceImage.imageObjectId}`);
            } catch (placeholderErr) {
              console.warn(`⚠️ Placeholder also failed for ${req.replaceImage.imageObjectId}, skipping`);
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
 * Creates a single presentation with multiple slides
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

  // For multiple products: copy template for first product
  const firstResult = await exportProductToSlides(products[0]);
  const presentationId = firstResult.presentationId;

  // Get the template presentation to know slide structure
  const templatePresentation = await slides.presentations.get({
    presentationId: TEMPLATE_SLIDE_ID,
  });
  const templateSlideCount = templatePresentation.data.slides?.length || 1;

  // For each additional product, duplicate slides and replace
  for (let i = 1; i < products.length; i++) {
    const product = products[i];
    
    // Get current presentation state
    const currentPresentation = await slides.presentations.get({
      presentationId,
    });
    const currentSlides = currentPresentation.data.slides || [];

    // Duplicate template slides (copy from first set)
    const duplicateRequests = [];
    for (let s = 0; s < templateSlideCount; s++) {
      if (currentSlides[s]) {
        duplicateRequests.push({
          duplicateObject: {
            objectId: currentSlides[s].objectId,
          },
        });
      }
    }

    const dupResult = await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: duplicateRequests },
    });

    // Get the new slide object IDs from the duplicate response
    const newSlideIds = dupResult.data.replies
      ?.map(r => r.duplicateObject?.objectId)
      .filter(Boolean) || [];

    // Replace text in new slides only
    const placeholderMap = buildPlaceholderMap(product);
    const replaceRequests = [];

    for (const newSlideId of newSlideIds) {
      for (const [placeholder, value] of Object.entries(placeholderMap)) {
        replaceRequests.push({
          replaceAllText: {
            containsText: {
              text: placeholder,
              matchCase: true,
            },
            replaceText: value,
            pageObjectIds: [newSlideId],
          },
        });
      }
    }

    if (replaceRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: replaceRequests },
      });
    }

    // Replace images on duplicated slides
    const validImages = (product.images || [])
      .filter(url => url && typeof url === 'string' && /^https?:\/\/.+/.test(url.trim()))
      .slice(0, 2);
    const slideImages = validImages.length > 0
      ? validImages
      : [PLACEHOLDER_IMAGE_URL, PLACEHOLDER_IMAGE_URL];

    // Find image elements on the newly duplicated slides
    const updatedPres = await slides.presentations.get({ presentationId });
    const allSlides = updatedPres.data.slides || [];

    for (const newSlideId of newSlideIds) {
      const newSlide = allSlides.find(s => s.objectId === newSlideId);
      if (!newSlide) continue;

      const imageElements = (newSlide.pageElements || [])
        .filter(el => el.image)
        .sort((a, b) => (a.transform?.translateY || 0) - (b.transform?.translateY || 0))
        .slice(0, 2);

      for (let j = 0; j < Math.min(imageElements.length, slideImages.length); j++) {
        const imgUrl = slideImages[j];
        if (!imgUrl) continue;
        try {
          await slides.presentations.batchUpdate({
            presentationId,
            requestBody: { requests: [{
              replaceImage: {
                imageObjectId: imageElements[j].objectId,
                url: imgUrl,
                imageReplaceMethod: 'CENTER_CROP',
              },
            }] },
          });
        } catch (imgErr) {
          console.warn(`⚠️ Image replace failed on duplicated slide, trying placeholder...`);
          try {
            await slides.presentations.batchUpdate({
              presentationId,
              requestBody: { requests: [{
                replaceImage: {
                  imageObjectId: imageElements[j].objectId,
                  url: PLACEHOLDER_IMAGE_URL,
                  imageReplaceMethod: 'CENTER_CROP',
                },
              }] },
            });
          } catch (_) {
            console.warn(`⚠️ Placeholder also failed, skipping`);
          }
        }
      }
    }
  }

  // Rename the presentation
  const fileName = `G2B Media - ${products.length} Products Export`;
  await drive.files.update({
    fileId: presentationId,
    supportsAllDrives: true,
    requestBody: { name: fileName },
  });

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
