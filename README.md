# 🌱 Hydro-Q - Sistem Monitoring Hidroponik Real-Time

Dashboard monitoring profesional untuk sistem hidroponik dengan sensor real-time menggunakan teknologi MQTT.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Configuration

### Environment Variables

Copy `.env.example` to `.env.local` dan isi dengan konfigurasi MQTT Anda:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_MQTT_URL=wss://your-hivemq-cluster.s2.region.hivemq.cloud:8884/mqtt
NEXT_PUBLIC_MQTT_TOPIC=hydroq/data
NEXT_PUBLIC_MQTT_USERNAME=your-username
NEXT_PUBLIC_MQTT_PASSWORD=your-password
```

## Deploy on Vercel

### Langkah-langkah Deployment:

1. **Push ke GitHub**
   ```bash
   git add .
   git commit -m "Deploy Hydro-Q monitoring system"
   git push origin main
   ```

2. **Connect ke Vercel**
   - Buka [Vercel Dashboard](https://vercel.com)
   - Klik "Add New Project"
   - Import repository GitHub Anda

3. **Set Environment Variables di Vercel**
   - Di Vercel Dashboard, buka Settings → Environment Variables
   - Tambahkan variable berikut:
     - `NEXT_PUBLIC_MQTT_URL`: URL HiveMQ broker Anda
     - `NEXT_PUBLIC_MQTT_TOPIC`: Topic untuk data sensor
     - `NEXT_PUBLIC_MQTT_USERNAME`: Username MQTT
     - `NEXT_PUBLIC_MQTT_PASSWORD`: Password MQTT

4. **Deploy**
   - Klik "Deploy"
   - Tunggu proses build selesai
   - Akses aplikasi di URL yang diberikan Vercel

### Tips:
- Pastikan HiveMQ broker Anda accessible dari internet
- Gunakan WSS (WebSocket Secure) untuk koneksi MQTT
- Simpan credentials di Vercel Environment Variables, jangan di kode

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
- [MQTT.js Documentation](https://github.com/mqttjs/MQTT.js)
