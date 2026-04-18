# Tài liệu học cho Thảo Đàn AI

Thư mục này chứa các tài liệu nghiệp vụ CTXH mà AI sẽ học để hỗ trợ NVXH tốt hơn.

## Cách thêm tài liệu

1. Tạo file `.md` hoặc `.txt` trong thư mục này
2. Đặt tên rõ ràng: `luat-tre-em-2016.md`, `quy-trinh-can-thiep.md`, v.v.
3. Push lên GitHub — GitHub Actions sẽ tự động index tài liệu vào Supabase

## Cấu trúc tài liệu gợi ý

```
docs/
├── luat-chinh-sach/
│   ├── luat-tre-em-2016.md
│   └── nghi-dinh-bao-ve-tre-em.md
├── quy-trinh-nvxh/
│   ├── sop-quan-ly-ca-ctxh-v1.md
│   ├── quy-trinh-tiep-can.md
│   ├── quy-trinh-vang-gia.md
│   └── quy-trinh-ket-thuc-ca.md
├── cong-cu-danh-gia/
│   ├── ma-tran-rui-ro.md
│   └── eco-map-genogram.md
└── tai-lieu-dao-tao/
    └── phu-mau-hoa.md
```

## Định dạng tài liệu

Mỗi file nên có header rõ ràng:

```markdown
# Tên tài liệu

**Nguồn:** ...
**Phiên bản:** vX.Y
**Ngày hiệu lực:** dd/mm/yyyy
**Người phê duyệt:** ...
**Ngày rà soát kế tiếp:** dd/mm/yyyy
**Tags:** luat, quy-trinh, danh-gia, ...

## Nội dung
...
```

## Lưu ý bảo mật

- KHÔNG đưa thông tin cá nhân của trẻ em vào đây
- Chỉ đưa tài liệu nghiệp vụ, quy trình, luật pháp
- Tài liệu được ẩn danh hóa trước khi gửi AI


## Quy tắc phiên bản tài liệu

- Major (`v2.0`): thay đổi nội dung nghiệp vụ cốt lõi hoặc quy trình.
- Minor (`v1.1`): bổ sung nội dung vận hành (checklist/KPI/playbook) không đổi khung lớn.
- Patch (`v1.0.1`): sửa lỗi trình bày/chính tả hoặc làm rõ câu chữ.

Mỗi lần cập nhật tài liệu nên thêm bảng `Lịch sử thay đổi` ở cuối tài liệu để phục vụ audit.
