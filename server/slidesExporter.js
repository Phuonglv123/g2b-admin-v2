import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template Slide ID
const TEMPLATE_SLIDE_ID = process.env.GOOGLE_SLIDES_TEMPLATE_ID || '1OljbL0izqkxUcg2VyDHIWbyMw9vK0qmLNBvNqwBxOSw';

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
function buildPlaceholderMap(product) {
  const attrs = product.attributes || {};
  
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

  // Traffic
  const traffic = product.traffic || '';

  // Local tax
  const localTax = product.local_tax 
    ? `Local tax: ${product.local_tax}% not included` 
    : '';

  // Near by / landmark
  const landmark = product.landmark || '';

  // Visibility from note
  const visibility = attrs.note || '';

  // Description
  const description = product.description || '';

  // City province
  const cityProvince = product.city_province || '';

  // Provider
  const providerName = product.provider_name || '';

  // Full address
  const address = product.location_address || '';

  // Booking duration
  const bookingDuration = product.booking_duration || '';

  // Spots per day - extract number from frequency
  const spotsDay = attrs.frequency || '';

  return {
    '{{product_name}}': product.product_name || '',
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

  // 4. Handle image replacements if product has images
  if (product.images && product.images.length > 0) {
    // Get the presentation to find image placeholders
    const presentation = await slides.presentations.get({
      presentationId: newPresentationId,
    });

    const slidePages = presentation.data.slides || [];
    
    for (const page of slidePages) {
      const elements = page.pageElements || [];
      for (const element of elements) {
        // Look for shapes with placeholder text like {{image_1}}, {{image_2}}, etc.
        if (element.shape && element.shape.text) {
          const textContent = element.shape.text.textElements
            ?.map(te => te.textRun?.content || '')
            .join('')
            .trim();
          
          const imageMatch = textContent?.match(/\{\{image_(\d+)\}\}/);
          if (imageMatch) {
            const imageIndex = parseInt(imageMatch[1]) - 1;
            if (product.images[imageIndex]) {
              const imageUrl = product.images[imageIndex];
              // Replace the shape with an image
              requests.push({
                deleteObject: {
                  objectId: element.objectId,
                },
              });
              requests.push({
                createImage: {
                  url: imageUrl,
                  elementProperties: {
                    pageObjectId: page.objectId,
                    size: element.size,
                    transform: element.transform,
                  },
                },
              });
            }
          }
        }
      }
    }
  }

  // 5. Execute batch update
  if (requests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId: newPresentationId,
      requestBody: { requests },
    });
    console.log(`Applied ${requests.length} replacements`);
  }

  // 6. Make the file accessible (anyone with link can view)
  await drive.permissions.create({
    fileId: newPresentationId,
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
  }

  // Rename the presentation
  const fileName = `G2B Media - ${products.length} Products Export`;
  await drive.files.update({
    fileId: presentationId,
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
