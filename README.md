# Chess FPT Web

Website chơi cờ vua với AI được huấn luyện từ 34 triệu ván cờ.

## Tính năng

- **AI thông minh** - Sử dụng model GPT được train trên 34M ván cờ
- **3 chế độ khó** - Dễ, Thường, Khó
- **Chọn bên** - Chơi quân trắng hoặc đen
- **Lịch sử nước đi** - Theo dõi các nước đã đi
- **Hiệu ứng đẹp** - Confetti khi thắng, animations mượt mà
- **Responsive** - Chơi được trên mọi thiết bị

## Cách sử dụng

### Chơi online
Truy cập: https://Huyvux12.github.io/chess-fpt-web

### Chạy local
```bash
# Clone repo
git clone https://github.com/Huyvux12/chess-fpt-web.git
cd chess-fpt-web

# Chạy với live-server (cần Node.js)
npx live-server web

# Hoặc dùng Python
cd web
python -m http.server 8000
```

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Chess AI**: Transformers.js + ONNX Model
- **Chess Logic**: chess.js
- **Design**: Glassmorphism, Dark Theme

## Cấu trúc

```
web/
├── index.html      # Main page
├── css/
│   └── style.css   # Styles
└── js/
    ├── app.js      # Game logic
    └── chess-ai.js # AI integration
```

## Cách chơi

1. Chọn màu quân (Trắng/Đen)
2. Chọn độ khó (Dễ/Thường/Khó)
3. Click "Bắt đầu ván đấu"
4. Click vào quân để xem nước đi hợp lệ
5. Click vào ô đích để di chuyển

## License

MIT License

