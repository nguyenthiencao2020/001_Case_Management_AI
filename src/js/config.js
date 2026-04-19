// ════════════════════════════════════════════════════════════
// CONFIG — Hằng số, cấu hình ứng dụng và STAGE_CONFIG
// ════════════════════════════════════════════════════════════

const GURL = '/api/chat';

const PRIVACY_PREFIX = `\n\n⚠️ BẢO MẬT DỮ LIỆU TRẺ EM (Luật ATTTM 2015 & NĐ 13/2023): Dữ liệu đã được ẩn danh hóa trước khi gửi. KHÔNG suy đoán danh tính thật. KHÔNG lưu trữ, tái tạo hoặc phổ biến thông tin định danh cá nhân. Chỉ phân tích nội dung chuyên môn bảo vệ trẻ em.`;

const LOGO_URL = 'https://raw.githubusercontent.com/nguyenthiencao2020/asif-brand-assets/82a695f369588161b12f90608c17088b84f8427c/ThaoDan_Logo.png';
const FOOTER_URL = 'https://raw.githubusercontent.com/nguyenthiencao2020/asif-brand-assets/82a695f369588161b12f90608c17088b84f8427c/ThaoDan_Footer.png';

const FORM_NAMES = [
  'HỒ SƠ THÔNG TIN TRẺ', 'PHIẾU TIẾP CẬN', 'PHÚC TRÌNH VÃNG GIA',
  'PHIẾU ĐÁNH GIÁ KHẨN CẤP', 'ĐÁNH GIÁ NHU CẦU', 'KẾ HOẠCH CAN THIỆP',
  'TIẾN ĐỘ THỰC HIỆN', 'CẬP NHẬT TIẾN TRÌNH', 'PHIẾU CHUYỂN GỬI',
  'PHIẾU KẾT THÚC CA', 'BÁO CÁO QLTH',
];

const STAGE_CONFIG = {
  1: {
    label: 'Giai đoạn 1 — Tiếp cận',
    btnText: '🔬 Phân tích Tiếp cận',
    inputLabel: '📝 Ghi chép Tiếp cận ban đầu',
    hint: 'Nhập ghi chép lần gặp đầu tiên. AI sẽ trích xuất Form 0 (Hồ sơ xã hội) và Form 1 (Phiếu tiếp cận).',
    placeholder: 'Paste ghi chép tiếp cận ban đầu...\n\nAI sẽ trích xuất Form 0 và Form 1.',
    completable: true,
    completeLabel: '✅ Hoàn thành GĐ 1 → GĐ 2',
    lockedForms: [],
  },
  2: {
    label: 'Giai đoạn 2 — Vãng gia & Đánh giá',
    btnText: '🏠 Phân tích Vãng gia',
    inputLabel: '📝 Ghi chép Vãng gia & Đánh giá',
    hint: 'Nhập ghi chép buổi vãng gia. AI sẽ trích xuất Form 2 (Phúc trình), Form 3a (Đánh giá khẩn cấp), Form 3b (Đánh giá nhu cầu).',
    placeholder: 'Paste ghi chép vãng gia...\n\nAI sẽ trích xuất Form 2, 3a, 3b.',
    completable: true,
    completeLabel: '✅ Hoàn thành GĐ 2 → GĐ 3',
    lockedForms: [0, 1],
  },
  3: {
    label: 'Giai đoạn 3 — Kế hoạch can thiệp',
    btnText: '🎯 Phân tích Kế hoạch',
    inputLabel: '📝 Ghi chép lập Kế hoạch',
    hint: 'Nhập ghi chép họp lập kế hoạch. AI sẽ trích xuất Form 4 (Kế hoạch can thiệp).',
    placeholder: 'Paste ghi chép lập kế hoạch can thiệp...\n\nAI sẽ trích xuất Form 4.',
    completable: true,
    completeLabel: '✅ Hoàn thành GĐ 3 → GĐ 4',
    lockedForms: [0, 1, 2, 3, 4],
  },
  4: {
    label: 'Giai đoạn 4 — Tiến trình (vòng lặp)',
    btnText: '🔄 Cập nhật Tiến trình',
    inputLabel: '📝 Ghi chép Cập nhật tiến trình',
    hint: 'Nhập ghi chép buổi theo dõi. AI sẽ THÊM VÀO (append) lịch sử Form 5, 6, 7 — không ghi đè dữ liệu cũ.',
    placeholder: 'Paste ghi chép theo dõi tiến trình...\n\nAI sẽ nối thêm (append) vào Form 5, 6, 7.',
    completable: true,
    completeLabel: '✅ Hoàn thành → Kết thúc ca',
    lockedForms: [0, 1, 2, 3, 4, 5],
  },
  5: {
    label: 'Giai đoạn 5 — Kết thúc ca',
    btnText: '🏁 Phân tích Kết thúc',
    inputLabel: '📝 Ghi chép Kết thúc ca',
    hint: 'Nhập ghi chép kết thúc. AI sẽ trích xuất Form 8 (Chuyển gửi), Form 9 (Kết thúc ca), Form 10 (Báo cáo QLTH).',
    placeholder: 'Paste ghi chép đóng ca...\n\nAI sẽ trích xuất Form 8, 9, 10.',
    completable: true,
    completeLabel: '✅ Đóng ca',
    lockedForms: [0, 1, 2, 3, 4, 5, 6, 7],
  },
};

const STAGE_TEMPLATES = {
  1: { title: 'Gợi ý — Tiếp cận ban đầu', items: [
    'Nguồn tiếp cận: ai / tổ chức nào giới thiệu ca này đến?',
    'Hoàn cảnh gia đình: trẻ đang sống cùng ai, quan hệ như thế nào?',
    'Lý do cần can thiệp CTXH là gì?',
    'Vấn đề nào cấp bách nhất tại thời điểm tiếp cận?',
    'Thái độ và phản ứng của gia đình khi NVXH tiếp cận?',
    'Trẻ có đang an toàn tại thời điểm tiếp cận không?',
  ]},
  2: { title: 'Gợi ý — Vãng gia & Đánh giá', items: [
    'Điều kiện nhà ở, sinh hoạt: sạch sẽ, an toàn, đủ không gian không?',
    'Quan sát quan hệ giữa các thành viên gia đình?',
    'Ai là người chăm sóc chính? Năng lực chăm sóc ra sao?',
    'Yếu tố bảo vệ của gia đình là gì (điểm mạnh, hỗ trợ xã hội)?',
    'Yếu tố nguy cơ quan sát được (thể chất, tâm lý, môi trường)?',
    'Trẻ thể hiện cảm xúc / hành vi như thế nào khi được thăm?',
    'Nhu cầu hỗ trợ theo thứ tự ưu tiên của gia đình?',
  ]},
  3: { title: 'Gợi ý — Kế hoạch can thiệp', items: [
    'Mục tiêu cụ thể, đo lường được cho 3–6 tháng tới?',
    'Các hoạt động cụ thể và người chịu trách nhiệm từng hoạt động?',
    'Nguồn lực huy động: gia đình, cộng đồng, dịch vụ xã hội nào?',
    'Gia đình đã đồng ý với kế hoạch chưa? Thái độ ra sao?',
    'Rào cản dự kiến khi thực hiện kế hoạch?',
    'Lịch gặp mặt / theo dõi tiếp theo đã thống nhất?',
  ]},
  4: { title: 'Gợi ý — Cập nhật tiến trình', items: [
    'Các hoạt động đã thực hiện từ lần gặp trước?',
    'Tiến độ so với mục tiêu đề ra (đạt / chưa đạt, tại sao)?',
    'Thay đổi ghi nhận ở trẻ và gia đình (hành vi, cảm xúc, quan hệ)?',
    'Rào cản gặp phải và cách xử lý?',
    'Cần điều chỉnh kế hoạch không? Điều chỉnh gì?',
    'Dịch vụ bên ngoài đã kết nối — hiệu quả như thế nào?',
  ]},
  5: { title: 'Gợi ý — Kết thúc ca', items: [
    'Kết quả đạt được so với mục tiêu ban đầu?',
    'Năng lực của gia đình tự duy trì sau khi can thiệp kết thúc?',
    'Chuyển gửi dịch vụ nào? Thông tin liên lạc đầu mối?',
    'Lý do kết thúc ca (đạt mục tiêu / gia đình từ chối / chuyển vùng...)?',
    'Đánh giá tổng thể: thành công / bài học cần cải thiện?',
    'Kế hoạch theo dõi sau can thiệp (nếu có)?',
  ]},
};
