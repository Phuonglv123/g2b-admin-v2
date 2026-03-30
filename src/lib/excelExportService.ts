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
  if (w && h) return `${w}m x ${h}m`
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
) {
  const metaData = { ...defaultMeta, ...meta }
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(
    `Quotation_G2B_${new Date().getFullYear()}`,
  )

  // -- Meta info rows (rows 1-6, logo can be added later) --
  const metaInfo = [
    ['', '', '', '', '', '', 'QUOTATION'],
    [
      'Brand:',
      metaData.brand,
      '',
      '',
      '',
      '',
      `Quotation No: G2B_${Math.floor(Date.now() / 1000)}`,
    ],
    ['Agency:', metaData.agency, '', '', '', '', `Sender: ${metaData.sender}`],
    [
      'Market:',
      metaData.market,
      '',
      '',
      '',
      '',
      `Phone number: ${metaData.phoneNumber}`,
    ],
    [
      'Duration:',
      metaData.duration,
      '',
      '',
      '',
      '',
      `Email: ${metaData.email}`,
    ],
    ['', '', '', '', '', '', `Sending date: ${metaData.sendingDate}`],
  ]

  metaInfo.forEach((row) => {
    const excelRow = worksheet.addRow(row)
    excelRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
  })

  // Merge meta cells
  worksheet.mergeCells('D1:F1')
  worksheet.mergeCells('A2:B2')
  worksheet.mergeCells('A3:B3')
  worksheet.mergeCells('A4:B4')
  worksheet.mergeCells('A5:B5')
  worksheet.mergeCells('A6:B6')
  worksheet.mergeCells('D2:F2')
  worksheet.mergeCells('D3:F3')
  worksheet.mergeCells('D4:F4')
  worksheet.mergeCells('D5:F5')
  worksheet.mergeCells('D6:F6')

  // Empty rows for spacing
  worksheet.addRow([])
  worksheet.addRow([])
  worksheet.addRow([])
  worksheet.addRow([])
  worksheet.addRow([])

  // -- Header row (row 12) --
  const headers = [
    'STT',
    'Type of Ad',
    'Code',
    'Name of media',
    'City',
    'Location',
    'Dimension (mWxmH)',
    'Video duration / Frequency / Operation Time',
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

  worksheet.addRow(headers)

  const headerRow = worksheet.getRow(12)
  headerRow.height = 60
  headerRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })

  // -- Data rows --
  products.forEach((product, index) => {
    const mediaCost = product.cost || 0
    const localTaxPct = product.local_tax || 0
    const netCost = localTaxPct > 0 ? mediaCost * (1 + localTaxPct / 100) : mediaCost

    const row = worksheet.addRow([
      index + 1,
      getTypeLabel(product.type),
      product.product_code,
      product.product_name,
      product.city_province || '',
      product.location_address || '',
      formatDimension(product),
      formatVideoFreqTime(product),
      product.attributes?.add_side || 1,
      product.booking_duration || '',
      product.booking_duration || '',
      product.currency || 'VND',
      mediaCost,
      product.production_cost || '',
      netCost,
      product.description || '',
      product.attributes?.note || '',
    ])

    row.height = 30
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.font = { size: 12 }
    })
  })

  // -- Summary rows --
  const totalCostRow = worksheet.addRow([
    '', '', '', '', '', '', '', '', '', '', '', '', '',
    'Total Cost:', '', '', '',
  ])
  const taxAppliedRow = worksheet.addRow([
    '', '', '', '', '', '', '', '', '', '', '', '', '',
    'Tax Applied:', '', '', '',
  ])
  const totalPaymentRow = worksheet.addRow([
    '', '', '', '', '', '', '', '', '', '', '', '', '',
    'Total Payment:', '', '', '',
  ])

  worksheet.mergeCells(`A${totalCostRow.number}:N${totalCostRow.number}`)
  worksheet.mergeCells(`A${taxAppliedRow.number}:N${taxAppliedRow.number}`)
  worksheet.mergeCells(`A${totalPaymentRow.number}:N${totalPaymentRow.number}`)

  ;[totalCostRow, taxAppliedRow, totalPaymentRow].forEach((row) => {
    row.eachCell((cell) => {
      cell.font = { bold: true }
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' },
      }
    })
  })

  // -- Auto column widths --
  worksheet.columns.forEach((column) => {
    let maxLength = 0
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const length = cell.value ? cell.value.toString().length : 10
      if (length > maxLength) maxLength = length
    })
    column.width = Math.min(maxLength + 2, 40)
  })

  // -- Spacing + Notes --
  const emptyRow = worksheet.addRow([])
  worksheet.mergeCells(`A${emptyRow.number}:Q${emptyRow.number}`)
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
    if (idx === 0) row.font = { bold: true }
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
