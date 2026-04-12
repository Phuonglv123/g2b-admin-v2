import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { ProductWithRelations } from '@/types/product'

interface MetaData {
  brand: string
  agency: string
  market: string
  duration: string
  sender: string
  phoneNumber: string
  email: string
  sendingDate: string
}

const defaultMeta: MetaData = {
  brand: '',
  agency: '',
  market: '',
  duration: '',
  sender: '',
  phoneNumber: '0937 95 30 30',
  email: 'sale@g2b.com.vn',
  sendingDate: new Date().toLocaleDateString('en-GB'),
}

function formatDimension(product: ProductWithRelations): string {
  const w = product.attributes?.width
  const h = product.attributes?.height
  if (w && h) {
    const area = w * h
    const areaFormatted = area >= 1000
      ? area.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : area.toLocaleString('en-US', { maximumFractionDigits: 2 })
    return `${w}x${h} = ${areaFormatted} m2`
  }
  return ''
}

function formatVideoFreqTime(product: ProductWithRelations): string {
  const attrs = product.attributes || {}
  const parts: string[] = []
  if (attrs.video_duration) parts.push(`${attrs.video_duration}s`)
  if (attrs.frequency) parts.push(`${attrs.frequency} spots`)
  if (attrs.opera_time_from && attrs.opera_time_to) {
    parts.push(`${attrs.opera_time_from} - ${attrs.opera_time_to}`)
  }
  return parts.join(' / ')
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    billboard: 'Billboard',
    digital: 'Digital',
    led: 'LED',
    transit: 'Transit',
    poster: 'Poster',
    banner: 'Banner',
    other: 'Other',
  }
  return labels[type] || type
}

export async function exportProductsToExcel(
  products: ProductWithRelations[],
  meta?: Partial<MetaData>,
  logoUrl?: string,
) {
  const metaData = { ...defaultMeta, ...meta }
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(
    `Quotation_G2B_${new Date().getFullYear()}`,
  )

  // -- Shared styles --
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  }
  const blueAccent = '003366'
  const yellowHeader = 'FFFF00'

  // -- Column widths matching template --
  const colWidths = [6, 12, 14, 30, 22, 30, 22, 38, 10, 14, 18, 10, 14, 16, 20, 10, 16]
  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w
  })

  // -- Blue top border line (row 1) --
  const blueLine1 = worksheet.addRow([])
  blueLine1.height = 4
  for (let c = 1; c <= 17; c++) {
    blueLine1.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blueAccent } }
  }

  // -- Logo image (overlay on A2:C5) --
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl)
      const logoBlob = await logoResponse.blob()
      const logoBuffer = await logoBlob.arrayBuffer()
      const imageId = workbook.addImage({
        buffer: logoBuffer,
        extension: 'png',
      })
      worksheet.addImage(imageId, 'A2:C5')
    } catch {
      // Skip logo if fetch fails
    }
  }

  // -- Meta info rows (rows 2-7) --
  // Row 2: blank left + QUOTATION right
  const row2 = worksheet.addRow([])
  row2.getCell(7).value = 'QUOTATION'
  row2.getCell(7).font = { bold: true, size: 14 }
  row2.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' }
  row2.height = 22

  // Row 3: Brand + Quotation No
  const quotNo = `G2B_${Math.floor(Date.now() / 1000)}`
  const row3 = worksheet.addRow([])
  row3.getCell(1).value = 'Brand:'
  row3.getCell(1).font = { bold: true }
  row3.getCell(2).value = metaData.brand
  row3.getCell(7).value = `Quotation No: ${quotNo}`
  row3.getCell(7).font = { bold: true }

  // Row 4: Agency + Sender
  const row4 = worksheet.addRow([])
  row4.getCell(1).value = 'Agency:'
  row4.getCell(1).font = { bold: true }
  row4.getCell(2).value = metaData.agency
  row4.getCell(7).value = `Sender: ${metaData.sender}`
  row4.getCell(7).font = { bold: true }

  // Row 5: Market + Phone
  const row5 = worksheet.addRow([])
  row5.getCell(1).value = 'Market:'
  row5.getCell(1).font = { bold: true }
  row5.getCell(2).value = metaData.market
  row5.getCell(7).value = `Phone number: ${metaData.phoneNumber}`
  row5.getCell(7).font = { bold: true }

  // Row 6: Duration + Email
  const row6 = worksheet.addRow([])
  row6.getCell(1).value = 'Duration:'
  row6.getCell(1).font = { bold: true }
  row6.getCell(2).value = metaData.duration
  row6.getCell(7).value = `Email: ${metaData.email}`
  row6.getCell(7).font = { bold: true }

  // Row 7: Sending date
  const row7 = worksheet.addRow([])
  row7.getCell(7).value = `Sending date: ${metaData.sendingDate}`
  row7.getCell(7).font = { bold: true }

  // -- Blue bottom separator (row 8) --
  const blueLine2 = worksheet.addRow([])
  blueLine2.height = 4
  for (let c = 1; c <= 17; c++) {
    blueLine2.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blueAccent } }
  }

  // -- Spacer rows (9-10) --
  worksheet.addRow([])
  worksheet.addRow([])

  // -- Header row (row 11) --
  const headers = [
    'STT',
    'Type of Ad',
    'Code',
    'Name of media',
    'City',
    'Location',
    'Dimension (mWxmH)',
    'Video duration / Frequency /Operation Time',
    'Ad sides',
    'Unit Buying',
    'Booking Duration',
    'Currency',
    'Media Cost',
    'Production Cost',
    'Total cost before TAX',
    'Remark',
    'Note',
  ]

  const headerRow = worksheet.addRow(headers)
  headerRow.height = 50
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: yellowHeader } }
    cell.border = thinBorder
    // Blue bottom border for header
    if (colNumber <= 17) {
      cell.border = {
        ...thinBorder,
        bottom: { style: 'medium', color: { argb: blueAccent } },
      }
    }
  })

  // -- Data rows --
  const dataStartRow = headerRow.number + 1
  products.forEach((product, index) => {
    const mediaCost = product.cost || 0
    const productionCost = parseFloat(String(product.production_cost || '0').replace(/[^\d.]/g, '')) || 0
    const totalBeforeTax = mediaCost + productionCost

    const row = worksheet.addRow([
      index + 1,                                               // A: STT
      getTypeLabel(product.type),                              // B: Type of Ad
      product.product_code,                                    // C: Code
      product.product_name,                                    // D: Name of media
      product.city_province || '',                             // E: City
      product.location_address || '',                          // F: Location
      formatDimension(product),                                // G: Dimension
      formatVideoFreqTime(product),                            // H: Video/Freq/Time
      product.attributes?.add_side || 1,                       // I: Ad sides
      mediaCost,                                               // J: Unit Buying
      product.booking_duration || '',                          // K: Booking Duration
      product.currency || 'VND',                               // L: Currency
      mediaCost,                                               // M: Media Cost
      productionCost || 0,                                     // N: Production Cost
      totalBeforeTax,                                          // O: Total cost before TAX
      '',                                                      // P: Remark
      product.attributes?.note || product.description || '',   // Q: Note
    ])

    row.height = 35
    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.font = { size: 10 }

      // Right-align numeric columns (J, M, N, O)
      if ([10, 13, 14, 15].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0'
        }
      }

      // Center small columns (A, I, L)
      if ([1, 9, 12].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
    })
  })

  const dataEndRow = dataStartRow + products.length - 1

  // -- Summary rows --
  // Total Cost
  const totalCostRow = worksheet.addRow([])
  worksheet.mergeCells(`A${totalCostRow.number}:N${totalCostRow.number}`)
  totalCostRow.getCell(1).value = 'Total Cost:'
  totalCostRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }
  totalCostRow.getCell(1).font = { bold: true, size: 11 }
  totalCostRow.getCell(1).border = thinBorder
  // Sum formula for column O
  totalCostRow.getCell(15).value = { formula: `SUM(O${dataStartRow}:O${dataEndRow})` }
  totalCostRow.getCell(15).numFmt = '#,##0'
  totalCostRow.getCell(15).font = { bold: true, size: 11 }
  totalCostRow.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' }
  totalCostRow.getCell(15).border = thinBorder

  // Tax Applied
  const taxRow = worksheet.addRow([])
  worksheet.mergeCells(`A${taxRow.number}:N${taxRow.number}`)
  taxRow.getCell(1).value = 'Tax Applied:'
  taxRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }
  taxRow.getCell(1).font = { bold: true, size: 11 }
  taxRow.getCell(1).border = thinBorder
  taxRow.getCell(15).value = ''
  taxRow.getCell(15).border = thinBorder

  // Total Payment
  const totalPaymentRow = worksheet.addRow([])
  worksheet.mergeCells(`A${totalPaymentRow.number}:N${totalPaymentRow.number}`)
  totalPaymentRow.getCell(1).value = 'Total Payment:'
  totalPaymentRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }
  totalPaymentRow.getCell(1).font = { bold: true, size: 11 }
  totalPaymentRow.getCell(1).border = thinBorder
  totalPaymentRow.getCell(15).value = ''
  totalPaymentRow.getCell(15).border = thinBorder

  // -- Spacing + Notes --
  worksheet.addRow([])
  worksheet.addRow([])

  const notes = [
    ['NOTE:'],
    ['Advertising costs include VAT'],
    ['Quotation is valid for 15 days'],
    ['The available slot will be checked in the booking duration'],
    ['For permit application requirements, please consult with the sales staff'],
    ['Other additional costs will be quoted separately'],
  ]

  notes.forEach((note, idx) => {
    const row = worksheet.addRow(note)
    worksheet.mergeCells(`A${row.number}:Q${row.number}`)
    row.getCell(1).font = idx === 0 ? { bold: true, size: 11 } : { size: 10 }
    if (idx === 4) {
      // Highlight "permit application" row like template
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      row.getCell(1).font = { size: 10, color: { argb: 'FFFFFFFF' } }
    }
  })

  worksheet.views = [{ showGridLines: false }]

  // -- Export --
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const firstType = products[0]?.type || 'products'
  saveAs(blob, `Quotation_${getTypeLabel(firstType)}_${new Date().getFullYear()}.xlsx`)
}

/**
 * Export a single product to Excel — uses the same quotation table format
 */
export async function exportSingleProductToExcel(product: ProductWithRelations) {
  return exportProductsToExcel([product])
}
