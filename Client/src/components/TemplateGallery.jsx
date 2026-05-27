import React from 'react';

const TEMPLATES = [
    {
        id: 'blank',
        name: 'Tài liệu trống',
        icon: '📄',
        desc: 'Bắt đầu từ trang trắng',
        content: '',
    },
    {
        id: 'meeting',
        name: 'Biên bản họp',
        icon: '📝',
        desc: 'Ghi chú cuộc họp chuyên nghiệp',
        content: `<h1>Biên bản họp</h1>
<p><strong>Ngày:</strong> ${new Date().toLocaleDateString('vi-VN')}</p>
<p><strong>Địa điểm:</strong> </p>
<p><strong>Người chủ trì:</strong> </p>
<p><strong>Thành phần tham dự:</strong> </p>
<hr/>
<h2>Nội dung thảo luận</h2>
<p>1. </p>
<p>2. </p>
<h2>Kết luận & Hành động tiếp theo</h2>
<p>• Nhiệm vụ: &nbsp;&nbsp;&nbsp; Người thực hiện: &nbsp;&nbsp;&nbsp; Hạn: </p>
<h2>Chữ ký</h2>
<p>Thư ký: ___________________&nbsp;&nbsp;&nbsp; Chủ trì: ___________________</p>`,
    },
    {
        id: 'report',
        name: 'Báo cáo',
        icon: '📊',
        desc: 'Báo cáo kết quả công việc',
        content: `<h1>BÁO CÁO</h1>
<p><strong>Tiêu đề:</strong> </p>
<p><strong>Ngày:</strong> ${new Date().toLocaleDateString('vi-VN')}</p>
<p><strong>Người lập:</strong> </p>
<hr/>
<h2>I. Tổng quan</h2>
<p></p>
<h2>II. Kết quả đạt được</h2>
<p></p>
<h2>III. Khó khăn & Tồn tại</h2>
<p></p>
<h2>IV. Kế hoạch tiếp theo</h2>
<p></p>`,
    },
    {
        id: 'project',
        name: 'Kế hoạch dự án',
        icon: '📌',
        desc: 'Lập kế hoạch & phân công',
        content: `<h1>KẾ HOẠCH DỰ ÁN</h1>
<p><strong>Tên dự án:</strong> </p>
<p><strong>Ngày bắt đầu:</strong> &nbsp;&nbsp; <strong>Ngày kết thúc:</strong> </p>
<p><strong>Nhóm thực hiện:</strong> </p>
<hr/>
<h2>🎯 Mục tiêu dự án</h2>
<p></p>
<h2>📋 Danh sách công việc</h2>
<p>☐ Nhiệm vụ 1 – Người thực hiện:</p>
<p>☐ Nhiệm vụ 2 – Người thực hiện:</p>
<p>☐ Nhiệm vụ 3 – Người thực hiện:</p>
<h2>⚠️ Rủi ro & Giải pháp</h2>
<p></p>
<h2>📈 Chỉ số thành công (KPIs)</h2>
<p></p>`,
    },
    {
        id: 'letter',
        name: 'Thư',
        icon: '📧',
        desc: 'Viết thư chính thức',
        content: `<p style="text-align:right">${new Date().toLocaleDateString('vi-VN')}</p>
<br/>
<p><strong>Kính gửi:</strong> </p>
<br/>
<p>Tôi xin phép viết thư này để ...</p>
<br/>
<p></p>
<br/>
<p>Trân trọng,</p>
<p><strong></strong></p>`,
    },
    {
        id: 'note',
        name: 'Ghi chú nhanh',
        icon: '🗒️',
        desc: 'Ghi chú & todo list',
        content: `<h1>📝 Ghi chú</h1>
<p>${new Date().toLocaleDateString('vi-VN')}</p>
<hr/>
<h2>✅ Việc cần làm hôm nay</h2>
<p>☐ </p>
<p>☐ </p>
<p>☐ </p>
<h2>💡 Ý tưởng</h2>
<p></p>
<h2>🔗 Links tham khảo</h2>
<p></p>`,
    },
];

const TemplateGallery = ({ onSelect, onClose }) => {
    return (
        <div className="template-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="template-modal">
                <div className="template-header">
                    <div>
                        <h2 className="template-title">Bắt đầu một tài liệu mới</h2>
                        <p className="template-subtitle">Chọn mẫu để tạo nhanh, hoặc bắt đầu từ trang trắng</p>
                    </div>
                    <button className="template-close" onClick={onClose}>✕</button>
                </div>
                <div className="template-grid">
                    {TEMPLATES.map(tpl => (
                        <button
                            key={tpl.id}
                            className="template-card"
                            onClick={() => onSelect(tpl)}
                            title={tpl.desc}
                        >
                            <div className="template-card-preview">
                                <span className="template-card-icon">{tpl.icon}</span>
                            </div>
                            <div className="template-card-info">
                                <span className="template-card-name">{tpl.name}</span>
                                <span className="template-card-desc">{tpl.desc}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TemplateGallery;
