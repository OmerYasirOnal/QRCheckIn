# QR Kod ile Yoklama Alma Sistemi
QR kod teknolojisi kullanarak öğrencilerin derse yoklama yapmasını sağlayan web tabanlı bir uygulamadır.

## Özellikler
- **Öğretmen Girişi**: Basit kullanıcı adı/şifre ile giriş
- **Ders Oluşturma**: Yeni ders oluşturma ve QR kod üretimi
- **QR Kod ile Yoklama**: Öğrenciler QR kodu okutarak yoklama yapabilir
- **Tekrar Giriş Kontrolü**: Aynı cihazdan ikinci kez yoklama engelleme
- **Anlık Liste**: Öğretmen yoklama listesini canlı olarak görüntüleyebilir
- **Responsive Tasarım**: Mobil ve desktop uyumlu modern arayüz

## Teknolojiler
### Backend
- **Node.js** - Sunucu tarafı JavaScript runtime
- **Express.js** - Web framework
- **SQLite** - Hafif veritabanı
- **UUID** - Benzersiz ID üretimi

### Frontend
- **HTML5/CSS3** - Modern web standartları
- **Vanilla JavaScript** - Framework bağımsız
- **QRCode.js** - QR kod üretimi (CDN: cdnjs.cloudflare.com)

## Kurulum
### 1. Projeyi İndirin
```bash
# Git ile klonlayın (eğer Git repository'si ise)
git clone <repository-url>
cd qr-yoklama-sistemi

# Veya dosyaları manuel olarak indirin
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Uygulamayı Başlatın
```bash
npm start
```

Uygulama `http://localhost:3000` adresinde çalışmaya başlayacaktır.

## Kullanım Kılavuzu
### Öğretmen Tarafı

1. **Giriş Yapın**
   - Tarayıcıda `http://localhost:3000` adresine gidin
   - Kullanıcı adı: `admin`
   - Şifre: `123456`

2. **Ders Oluşturun**
   - Ders adını girin (örn: Matematik)

## Installation
To install the project, follow these steps:
1. Clone the repository using Git: `git clone <repository-url>`
2. Navigate to the project directory: `cd qr-yoklama-sistemi`
3. Install the dependencies: `npm install`
4. Start the application: `npm start`

## Usage
To use the application, follow these steps:
1. Open a web browser and navigate to `http://localhost:3000`
2. Log in with the username `admin` and password `123456`
3. Create a new class by entering the class name (e.g., Matematik)

## License
This project is licensed under the MIT License.