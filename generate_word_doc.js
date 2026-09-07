const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType
} = require('docx');

// Colors
const PRIMARY_COLOR = '059669'; // Emerald Green
const DARK_BG = '1E293B';
const LIGHT_BG = 'F1F5F9';
const BORDER_COLOR = 'CBD5E1';
const WHITE = 'FFFFFF';
const AGRI_RED = '8E1424';

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }
};

function createHeaderCell(text, widthPercent) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: PRIMARY_COLOR, type: ShadingType.CLEAR },
    borders: cellBorder,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: text,
            bold: true,
            color: WHITE,
            font: 'Arial',
            size: 20 // 10pt
          })
        ]
      })
    ]
  });
}

function createCell(text, widthPercent, isBold = false, align = AlignmentType.LEFT, isCode = false) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: text,
            bold: isBold,
            color: isCode ? '2563EB' : '1E293B',
            font: isCode ? 'Consolas' : 'Arial',
            size: 19 // 9.5pt
          })
        ]
      })
    ]
  });
}

async function generate() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'TRƯỜNG ĐÀO TẠO CÁN BỘ AGRIBANK',
                bold: true,
                size: 28, // 14pt
                font: 'Arial',
                color: AGRI_RED
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: 'TÀI LIỆU MÔ TẢ CHỨC NĂNG VÀ CÁC MỨC PHÂN QUYỀN HỆ THỐNG',
                bold: true,
                size: 24, // 12pt
                font: 'Arial',
                color: '0F172A'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: 'Hệ thống Theo dõi, Đôn đốc Công việc & Kê khai Nhật ký Nội bộ',
                italics: true,
                size: 20,
                font: 'Arial',
                color: '64748B'
              })
            ]
          }),

          // Heading 1
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 150 },
            children: [
              new TextRun({
                text: 'I. BẢNG MÔ TẢ 4 CẤP ĐỘ PHÂN QUYỀN (ROLE-BASED ACCESS CONTROL)',
                bold: true,
                size: 22,
                font: 'Arial',
                color: PRIMARY_COLOR
              })
            ]
          }),

          // Table 1: 4 Roles
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('STT', 8),
                  createHeaderCell('Cấp Vai Trò', 22),
                  createHeaderCell('Mã Role', 12),
                  createHeaderCell('Đối Tượng Áp Dụng', 22),
                  createHeaderCell('Phạm Vi Quyền Hạn & Trách Nhiệm', 36)
                ]
              }),
              new TableRow({
                children: [
                  createCell('1', 8, true, AlignmentType.CENTER),
                  createCell('🏛️ Ban Giám đốc', 22, true),
                  createCell('director', 12, false, AlignmentType.CENTER, true),
                  createCell('Hiệu trưởng, các Phó Hiệu trưởng', 22),
                  createCell('• Toàn quyền chỉ đạo, giám sát 5 phòng ban.\n• Xem Dashboard toàn trường & riêng từng phòng.\n• Xem và xuất bản kê khai nhật ký của toàn bộ nhân sự.', 36)
                ]
              }),
              new TableRow({
                children: [
                  createCell('2', 8, true, AlignmentType.CENTER),
                  createCell('👑 Quản trị viên (Admin)', 22, true),
                  createCell('admin', 12, false, AlignmentType.CENTER, true),
                  createCell('Cán bộ Quản trị hệ thống (Phòng Tổng hợp / IT)', 22),
                  createCell('• Toàn quyền Quản trị kỹ thuật: Tạo mới tài khoản, phân quyền 4 cấp, đặt lại mật khẩu, quản lý 5 phòng ban, theo dõi Audit Log.\n• Quản lý công việc và kê khai nhật ký.', 36)
                ]
              }),
              new TableRow({
                children: [
                  createCell('3', 8, true, AlignmentType.CENTER),
                  createCell('⭐ Cấp Trưởng phòng', 22, true),
                  createCell('manager', 12, false, AlignmentType.CENTER, true),
                  createCell('Trưởng phòng, Phó Trưởng phòng 5 phòng ban', 22),
                  createCell('• Quản lý công việc nội bộ phòng mình: Giao việc, đôn đốc, cập nhật tiến độ.\n• Xem và xuất bản kê khai nhật ký của các cán bộ thuộc phòng mình.\n• Kê khai nhật ký công việc của bản thân.', 36)
                ]
              }),
              new TableRow({
                children: [
                  createCell('4', 8, true, AlignmentType.CENTER),
                  createCell('👤 Nhân viên', 22, true),
                  createCell('staff', 12, false, AlignmentType.CENTER, true),
                  createCell('Cán bộ, chuyên viên, nhân viên các phòng ban', 22),
                  createCell('• Xem danh sách công việc được giao, cập nhật % hoàn thành và ghi log theo ngày.\n• Kê khai Bản nhật ký công việc cá nhân (Từ ngày -> Đến ngày).\n• Xuất bản kê khai cá nhân ra file Excel.', 36)
                ]
              })
            ]
          }),

          // Heading 2
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: 'II. MA TRẬN PHÂN QUYỀN CHỨC NĂNG CHI TIẾT (PERMISSION MATRIX)',
                bold: true,
                size: 22,
                font: 'Arial',
                color: PRIMARY_COLOR
              })
            ]
          }),

          // Table 2: Permission Matrix
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Nhóm Chức Năng', 25),
                  createHeaderCell('Chức Năng Chi Tiết', 35),
                  createHeaderCell('🏛️ Ban GĐ', 10),
                  createHeaderCell('👑 Admin', 10),
                  createHeaderCell('⭐ Trưởng phòng', 10),
                  createHeaderCell('👤 GV / NV', 10)
                ]
              }),
              new TableRow({
                children: [
                  createCell('1. Dashboard Tổng Quan', 25, true),
                  createCell('Xem KPI & Biểu đồ Toàn Trường (5 phòng)', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Xem chi tiết tiến độ & cán bộ riêng từng phòng', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓ (Phòng mình)', 10, false, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('2. Quản Lý & Giao Việc', 25, true),
                  createCell('Xem danh sách / Kanban công việc Toàn Trường', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Xem công việc thuộc Phòng ban của mình', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓ (Được giao)', 10, false, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Tạo mới và Giao việc cho nhân sự', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓ (Trong phòng)', 10, false, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Cập nhật % tiến độ & nhật ký công việc ngày', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Xóa công việc', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓ (Phòng mình)', 10, false, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('3. Bản Kê Khai Nhật Ký', 25, true),
                  createCell('Kê khai nhật ký cá nhân (Từ ngày -> Đến ngày)', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Tự nhập phân loại hoạt động & gắn nhiệm vụ', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Xem nhật ký của nhân sự khác', 35),
                  createCell('✓ (Toàn trường)', 10, false, AlignmentType.CENTER),
                  createCell('✓ (Toàn trường)', 10, false, AlignmentType.CENTER),
                  createCell('✓ (Trong phòng)', 10, false, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('4. Xuất Báo Cáo Excel', 25, true),
                  createCell('Xuất Bản kê khai nhật ký cá nhân (.xlsx)', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Xuất danh sách công việc 5 phòng ban (.xlsx)', 35),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('✓ (Phòng mình)', 10, false, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('5. Quản Trị Hệ Thống', 25, true),
                  createCell('Tạo tài khoản mới, phân quyền 4 cấp', 35),
                  createCell('—', 10, false, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Đặt lại (Reset) mật khẩu người dùng', 35),
                  createCell('—', 10, false, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER)
                ]
              }),
              new TableRow({
                children: [
                  createCell('', 25),
                  createCell('Quản lý danh mục 5 Phòng ban & Audit Log', 35),
                  createCell('—', 10, false, AlignmentType.CENTER),
                  createCell('✓', 10, true, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER),
                  createCell('—', 10, false, AlignmentType.CENTER)
                ]
              })
            ]
          }),

          // Heading 3
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: 'III. MÔ TẢ CHI TIẾT CÁC MODULE CHỨC NĂNG CỦA ỨNG DỤNG',
                bold: true,
                size: 22,
                font: 'Arial',
                color: PRIMARY_COLOR
              })
            ]
          }),

          // Table 3: Detailed Modules
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Module Chức Năng', 25),
                  createHeaderCell('Mục Đích & Nghiệp Vụ Hỗ Trợ', 40),
                  createHeaderCell('Các Trường Thông Tin & Tính Năng Nổi Bật', 35)
                ]
              }),
              new TableRow({
                children: [
                  createCell('1. Dashboard Tổng Quan\n(/dashboard)', 25, true),
                  createCell('Cung cấp bức tranh toàn cảnh về tiến độ, khối lượng công việc và hiệu suất toàn bộ 5 phòng ban Trường Đào tạo cán bộ Agribank.', 40),
                  createCell('• Bộ chuyển đổi Dual-Scope: Toàn Trường vs Riêng Phòng.\n• 4 thẻ KPI: Tổng việc, Hoàn thành, Trễ hạn, Tỷ lệ hoàn thành %.\n• Biểu đồ so sánh 5 phòng ban & biểu đồ tròn phân bổ trạng thái.\n• Bảng tổng hợp số liệu 5 phòng ban.', 35)
                ]
              }),
              new TableRow({
                children: [
                  createCell('2. Quản Lý & Giao Việc\n(/tasks)', 25, true),
                  createCell('Giao việc, đôn đốc tiến độ, kiểm soát hạn chót của các nhiệm vụ chuyên môn và đề tài.', 40),
                  createCell('• 2 Chế độ hiển thị: Bảng Kanban kéo thả & Bảng danh sách.\n• Bộ lọc: Phòng ban, mức ưu tiên (Khẩn cấp/Cao/TB/Thấp), trạng thái.\n• Giao việc đa nhân sự (Người phụ trách chính & Phối hợp).\n• Thanh trượt tiến độ 0-100% & ghi log theo ngày.', 35)
                ]
              }),
              new TableRow({
                children: [
                  createCell('3. Bản Kê Khai Nhật Ký\n(/personal-logs)', 25, true),
                  createCell('Cán bộ chủ động kê khai minh bạch thời gian, nội dung, địa điểm và kết quả thực hiện phục vụ đánh giá KPI tháng/quý.', 40),
                  createCell('• Bộ chọn thời gian: Từ ngày (Bắt đầu) -> Đến ngày (Kết thúc).\n• Tự nhập linh hoạt (Free-text) phân loại hoạt động & nhiệm vụ gắn kết.\n• Ghi nhận giờ công thực tế, quy đổi ngày công.\n• Ghi nhận sản phẩm đầu ra & link tài liệu minh chứng.\n• Ban Giám đốc & Trưởng phòng xem được cấp dưới.', 35)
                ]
              }),
              new TableRow({
                children: [
                  createCell('4. Xuất Báo Cáo Excel\n(/export)', 25, true),
                  createCell('Phục vụ công tác họp giao ban định kỳ, đánh giá thi đua khen thưởng và lưu trữ dữ liệu.', 40),
                  createCell('• Xuất Bản kê khai nhật ký cá nhân chuẩn format Excel (.xlsx).\n• Xuất Báo cáo tiến độ công việc 5 phòng ban.\n• Định dạng cột tự động căn chỉnh đẹp mắt.', 35)
                ]
              }),
              new TableRow({
                children: [
                  createCell('5. Quản Trị Hệ Thống\n(/admin - Dành cho Admin)', 25, true),
                  createCell('Vận hành kỹ thuật, bảo mật tài khoản, phân quyền và giám sát hoạt động hệ thống.', 40),
                  createCell('• Quản lý người dùng: Tạo mới, sửa thông tin, phân 4 cấp vai trò.\n• Đặt lại (Reset) mật khẩu người dùng.\n• Quản lý danh mục 5 Phòng Ban của Trường.\n• Nhật ký thao tác (Audit Log) ghi nhận toàn bộ hành động.', 35)
                ]
              })
            ]
          }),

          // Heading 4
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: 'IV. DANH SÁCH TÀI KHOẢN MẪU ĐĂNG NHẬP 4 CẤP PHÂN QUYỀN',
                bold: true,
                size: 22,
                font: 'Arial',
                color: PRIMARY_COLOR
              })
            ]
          }),

          // Table 4: Demo accounts
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Cấp Vai Trò', 20),
                  createHeaderCell('Tên Đăng Nhập', 18),
                  createHeaderCell('Họ và Tên Cán Bộ', 25),
                  createHeaderCell('Phòng Ban / Chức Vụ', 25),
                  createHeaderCell('Mật Khẩu', 12)
                ]
              }),
              new TableRow({
                children: [
                  createCell('🏛️ Ban Giám đốc', 20, true),
                  createCell('bgd_hung', 18, true, AlignmentType.LEFT, true),
                  createCell('TS. Nguyễn Văn Hùng', 25),
                  createCell('Hiệu trưởng', 25),
                  createCell('123456', 12, false, AlignmentType.CENTER, true)
                ]
              }),
              new TableRow({
                children: [
                  createCell('🏛️ Ban Giám đốc', 20, true),
                  createCell('bgd_minh', 18, true, AlignmentType.LEFT, true),
                  createCell('ThS. Trần Văn Minh', 25),
                  createCell('Phó Hiệu trưởng', 25),
                  createCell('123456', 12, false, AlignmentType.CENTER, true)
                ]
              }),
              new TableRow({
                children: [
                  createCell('👑 Admin Quản trị', 20, true),
                  createCell('admin', 18, true, AlignmentType.LEFT, true),
                  createCell('Trần Thị Mai Lan', 25),
                  createCell('Phòng Tổng hợp', 25),
                  createCell('123456', 12, false, AlignmentType.CENTER, true)
                ]
              }),
              new TableRow({
                children: [
                  createCell('⭐ Trưởng phòng', 20, true),
                  createCell('tp_qldt', 18, true, AlignmentType.LEFT, true),
                  createCell('ThS. Lê Hoàng Nam', 25),
                  createCell('Trưởng phòng QLĐT & Thư viện', 25),
                  createCell('123456', 12, false, AlignmentType.CENTER, true)
                ]
              }),
              new TableRow({
                children: [
                  createCell('⭐ Trưởng phòng', 20, true),
                  createCell('tp_ketoan', 18, true, AlignmentType.LEFT, true),
                  createCell('Nguyễn Thị Thu Hà', 25),
                  createCell('Trưởng phòng Kế toán', 25),
                  createCell('123456', 12, false, AlignmentType.CENTER, true)
                ]
              }),
              new TableRow({
                children: [
                  createCell('👤 Nhân viên', 20, true),
                  createCell('gv_minh', 18, true, AlignmentType.LEFT, true),
                  createCell('ThS. Phạm Quang Minh', 25),
                  createCell('Nhân viên', 25),
                  createCell('123456', 12, false, AlignmentType.CENTER, true)
                ]
              }),
              new TableRow({
                children: [
                  createCell('👤 Nhân viên', 20, true),
                  createCell('nv_hoa', 18, true, AlignmentType.LEFT, true),
                  createCell('Nguyễn Thị Thu Hòa', 25),
                  createCell('Phó phòng', 25),
                  createCell('123456', 12, false, AlignmentType.CENTER, true)
                ]
              }),
              new TableRow({
                children: [
                  createCell('👤 Nhân viên', 20, true),
                  createCell('nv_linh', 18, true, AlignmentType.LEFT, true),
                  createCell('Đỗ Thùy Linh', 25),
                  createCell('Nhân viên', 25),
                  createCell('123456', 12, false, AlignmentType.CENTER, true)
                ]
              })
            ]
          }),

          // Footer note
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: `Hà Nội, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`,
                italics: true,
                size: 19,
                font: 'Arial',
                color: '64748B'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 100 },
            children: [
              new TextRun({
                text: 'TRƯỜNG ĐÀO TẠO CÁN BỘ AGRIBANK',
                bold: true,
                size: 20,
                font: 'Arial',
                color: AGRI_RED
              })
            ]
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, 'Mo_ta_chuc_nang_va_phan_quyen_Agribank.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('Successfully generated Word file at:', outputPath);
}

generate().catch(console.error);
