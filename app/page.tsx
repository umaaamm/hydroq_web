'use client';

import { useEffect, useState } from 'react';
import mqtt from 'mqtt';

export default function MqttSensorPage() {
  // State awal disesuaikan dengan skema JSON data sensor Anda
  const [sensorData, setSensorData] = useState({
    ppm: 0,
    suhu: 0.0,
    rssi: 0,
    heap: 0,
    tanggal_update: null,
  });

  const [statusData, setStatusData] = useState<{
    status: string;
    waktu_status: number | null;
  }>({
    status: 'offline',
    waktu_status: null,
  });

  const [statusKoneksi, setStatusKoneksi] = useState('Menghubungkan...');

  useEffect(() => {
    // 💡 Ganti dengan URL Cluster HiveMQ Cloud Anda (Wajib pakai wss:// dan port WebSockets, biasanya 8884)
    // Jika untuk uji coba lokal/publik tanpa enkripsi, bisa pakai: 'wss://://hivemq.com'
    const brokerUrl = process.env.NEXT_PUBLIC_MQTT_URL || 'wss://92026fedf84e4428a73c218274c62e31.s2.eu.hivemq.cloud:8884/mqtt';
    const topicData = process.env.NEXT_PUBLIC_MQTT_TOPIC || 'hydroq/data';
    const topicStatus = 'hydroq/status';
    
    const opsiKoneksi = {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME || 'hydroq',
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || 'hydroq123',
      clientId: 'nextjs_client_' + Math.random().toString(16).substr(2, 8),
    };

    const client = mqtt.connect(brokerUrl, opsiKoneksi);

    client.on('connect', () => {
      setStatusKoneksi('Terhubung ke HiveMQ');
      client.subscribe([topicData, topicStatus]);
    });

    client.on('message', (topikMqtt, pesan) => {
      try {
        const pesanString = pesan.toString();
        console.log(`Pesan diterima dari topik ${topikMqtt}:`, pesanString);
        
        // Menangani pesan dari topic hydroq/data
        if (topikMqtt === topicData) {
          // Parsing JSON untuk hydroq/data
          const parsingData = JSON.parse(pesanString);
          setSensorData(parsingData);
        }
        // Menangani pesan dari topic hydroq/status
        else if (topikMqtt === topicStatus) {
          // Topic status mengirimkan plain string seperti "online", "offline", dll
          setStatusData(prevData => ({
            ...prevData,
            status: pesanString.toLowerCase(),
            waktu_status: Math.floor(Date.now() / 1000)
          }));
        }
      } catch (error) {
        console.error('Format pesan gagal diparsing (Bukan JSON):', error);
      }
    });

    client.on('error', (err) => {
      console.error('MQTT Error:', err);
      setStatusKoneksi('Koneksi Gagal');
    });

    client.on('offline', () => {
      setStatusKoneksi('Koneksi Terputus (Offline)');
    });

    // Membersihkan (disconnect) koneksi MQTT saat halaman ditutup/pindah
    return () => {
      if (client) client.end();
    };
  }, []);

  // Fungsi mengubah Unix Timestamp (Detik) ke format Waktu Indonesia Readable
  const formatWaktu = (timestamp: number | null): string => {
    if (!timestamp) return '-';
    const tanggal = new Date(timestamp * 1000); 
    return tanggal.toLocaleString('id-ID');
  };

  const getWifiQuality = (rssi: number): string => {
    if (rssi >= -50) return 'Sangat kuat';
    if (rssi >= -60) return 'Kuat';
    if (rssi >= -70) return 'Cukup baik';
    if (rssi >= -80) return 'Lemah';
    return 'Sangat lemah';
  };

  const formatHeap = (value: number): string => `${value.toLocaleString('id-ID')} byte`;

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f4c75 100%)',
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      padding: '24px',
      color: '#ffffff'
    }}>
      {/* Konten Utama */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header dengan Logo */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ 
              fontSize: '32px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #00d4ff 0%, #0ea5e9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              🌱 Hydro-Q
            </div>
          </div>
          <p style={{ margin: '0', fontSize: '14px', color: '#cbd5e1', letterSpacing: '1px' }}>
            SISTEM MONITORING HIDROPONIK REAL-TIME
          </p>
        </div>

        {/* Status Koneksi */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            padding: '12px 24px',
            borderRadius: '50px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: statusKoneksi.includes('Terhubung') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: statusKoneksi.includes('Terhubung') ? '#86efac' : '#fca5a5',
            border: `2px solid ${statusKoneksi.includes('Terhubung') ? '#22c55e' : '#ef4444'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: statusKoneksi.includes('Terhubung') ? '#22c55e' : '#ef4444',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}></span>
            {statusKoneksi}
          </div>
        </div>

        {/* Status Sistem Card */}
        <div style={{
          marginBottom: '32px',
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(15, 76, 117, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)',
          borderRadius: '12px',
          border: '2px solid rgba(0, 212, 255, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: '#00d4ff', letterSpacing: '0.5px' }}>
            ⚙️ STATUS SISTEM
          </h2>
          <div style={{
            padding: '16px',
            background: statusData.status === 'online' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderRadius: '8px',
            border: `1px solid ${statusData.status === 'online' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Status Perangkat</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: statusData.status === 'online' ? '#22c55e' : '#ef4444',
                animation: statusData.status === 'online' ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
              }}></span>
              <p style={{ 
                margin: 0, 
                fontSize: '20px', 
                fontWeight: '700', 
                color: statusData.status === 'online' ? '#86efac' : '#fca5a5',
                textTransform: 'capitalize'
              }}>{statusData.status}</p>
            </div>
          </div>
        </div>

        {/* Network & Memory Status */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
            borderRadius: '12px',
            border: '2px solid rgba(34, 197, 94, 0.3)',
            boxShadow: '0 10px 30px rgba(34, 197, 94, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-50%',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.18) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}></div>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>📶 RSSI Wi‑Fi</p>
            <p style={{ margin: '0', fontSize: '36px', fontWeight: '700', color: '#4ade80' }}>
              {sensorData.rssi} dBm
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#b7f0c8', fontWeight: '600' }}>
              {getWifiQuality(sensorData.rssi)}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#64748b' }}>
              Semakin mendekati 0, sinyal semakin kuat
            </p>
          </div>

          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%)',
            borderRadius: '12px',
            border: '2px solid rgba(168, 85, 247, 0.3)',
            boxShadow: '0 10px 30px rgba(168, 85, 247, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-50%',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}></div>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>🧠 Heap RAM</p>
            <p style={{ margin: '0', fontSize: '30px', fontWeight: '700', color: '#c084fc' }}>
              {formatHeap(sensorData.heap)}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#e9d5ff', fontWeight: '600' }}>
              RAM bebas tersedia
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#64748b' }}>
              Digunakan untuk Wi‑Fi, MQTT, dan pemrosesan sensor
            </p>
          </div>
        </div>

        {/* Sensor Data Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          
          {/* Card Sensor - PPM */}
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%)',
            borderRadius: '12px',
            border: '2px solid rgba(6, 182, 212, 0.3)',
            boxShadow: '0 10px 30px rgba(6, 182, 212, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-50%',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}></div>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>💧 Nutrisi (PPM)</p>
            <p style={{ margin: '0', fontSize: '36px', fontWeight: '700', color: '#06b6d4' }}>
              {sensorData.ppm}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>Parts Per Million</p>
          </div>

          {/* Card Sensor - Suhu Air */}
          <div style={{
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
            borderRadius: '12px',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            boxShadow: '0 10px 30px rgba(59, 130, 246, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-50%',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}></div>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>🌊 Suhu Air</p>
            <p style={{ margin: '0', fontSize: '36px', fontWeight: '700', color: '#3b82f6' }}>
              {sensorData.suhu}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>Derajat Celsius</p>
          </div>
        </div>

        {/* Footer dengan Timestamp */}
        <div style={{
          padding: '20px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center',
          fontSize: '12px',
          color: '#94a3b8'
        }}>
          <p style={{ margin: 0 }}>📡 Update Terakhir: <span style={{ color: '#06b6d4', fontWeight: '600' }}>{formatWaktu(sensorData.tanggal_update)}</span></p>
          <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#64748b' }}>Sistem monitoring Hydro-Q aktif dan berjalan normal</p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
