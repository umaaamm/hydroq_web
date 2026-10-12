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
  const [historyPpm, setHistoryPpm] = useState<number[]>(Array.from({ length: 20 }, () => 0));
  const [historySuhu, setHistorySuhu] = useState<number[]>(Array.from({ length: 20 }, () => 0));
  const [selectedCrop, setSelectedCrop] = useState<'selada' | 'pakcoy' | 'tandon_bersama'>('selada');
  const [selectedPhase, setSelectedPhase] = useState<'semai' | 'vegetatif' | 'utama'>('vegetatif');
  const [ppmScale, setPpmScale] = useState<500 | 700>(700);

  const growthPhaseLabels = {
    semai: 'Fase Benih / Semaian',
    vegetatif: 'Fase Vegetatif Awal / Pertumbuhan Daun',
    utama: 'Fase Pertumbuhan Utama & Menjelang Panen',
  } as const;

  const cropLabels = {
    selada: 'Selada',
    pakcoy: 'Pakcoy',
    tandon_bersama: 'Tandon bersama (Selada + Pakcoy)',
  } as const;

  const cropThresholds = {
    selada: {
      semai: { ec: { min: 0.6, max: 0.8 }, suhu: { min: 22, max: 24 } },
      vegetatif: { ec: { min: 0.8, max: 1.2 }, suhu: { min: 22, max: 24 } },
      utama: { ec: { min: 1.2, max: 1.8 }, suhu: { min: 22, max: 24 } },
    },
    pakcoy: {
      semai: { ec: { min: 0.8, max: 1.0 }, suhu: { min: 22, max: 24 } },
      vegetatif: { ec: { min: 1.0, max: 1.5 }, suhu: { min: 22, max: 24 } },
      utama: { ec: { min: 1.5, max: 2.0 }, suhu: { min: 22, max: 24 } },
    },
    tandon_bersama: {
      semai: { ec: { min: 0.7, max: 0.9 }, suhu: { min: 22, max: 24 } },
      vegetatif: { ec: { min: 1.0, max: 1.2 }, suhu: { min: 22, max: 24 } },
      utama: { ec: { min: 1.5, max: 1.8 }, suhu: { min: 22, max: 24 } },
    },
  } as const;

  const getStatusLevel = (value: number, min: number, max: number): 'rendah' | 'normal' | 'tinggi' => {
    if (value < min) return 'rendah';
    if (value > max) return 'tinggi';
    return 'normal';
  };

  const getStatusStyle = (status: 'rendah' | 'normal' | 'tinggi') => {
    if (status === 'normal') {
      return {
        background: 'rgba(22, 163, 74, 0.2)',
        border: '1px solid rgba(74, 222, 128, 0.75)',
        color: '#bbf7d0',
      };
    }

    if (status === 'tinggi') {
      return {
        background: 'rgba(220, 38, 38, 0.2)',
        border: '1px solid rgba(248, 113, 113, 0.8)',
        color: '#fecaca',
      };
    }

    return {
      background: 'rgba(217, 119, 6, 0.2)',
      border: '1px solid rgba(251, 191, 36, 0.8)',
      color: '#fde68a',
    };
  };

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
          setHistoryPpm(prev => {
            const next = [...prev, Number(parsingData.ppm ?? 0)];
            return next.slice(-20);
          });
          setHistorySuhu(prev => {
            const next = [...prev, Number(parsingData.suhu ?? 0)];
            return next.slice(-20);
          });
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

  const buildChartPoints = (values: number[]) => {
    if (!values.length) return '0,90 100,90';

    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const range = max - min || 1;

    return values.map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 80 - 10;
      return `${x},${y}`;
    }).join(' ');
  };

  const buildAreaPath = (values: number[]) => {
    if (!values.length) return 'M 0 100 L 100 100 L 100 100 Z';

    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const range = max - min || 1;

    const points = values.map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 80 - 10;
      return [x, y] as const;
    });

    if (points.length === 1) {
      return `M ${points[0][0]} 100 L ${points[0][0]} ${points[0][1]} L ${points[0][0]} 100 Z`;
    }

    return [
      `M ${points[0][0]} 100`,
      ...points.map(([x, y]) => `L ${x} ${y}`),
      `L ${points[points.length - 1][0]} 100`,
      'Z'
    ].join(' ');
  };

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const selectedThreshold = cropThresholds[selectedCrop][selectedPhase];
  const ppmThreshold = {
    min: Math.round(selectedThreshold.ec.min * ppmScale),
    max: Math.round(selectedThreshold.ec.max * ppmScale),
  };
  const ppmStatus = getStatusLevel(sensorData.ppm, ppmThreshold.min, ppmThreshold.max);
  const suhuStatus = getStatusLevel(sensorData.suhu, selectedThreshold.suhu.min, selectedThreshold.suhu.max);
  const ppmProgress = clamp(((sensorData.ppm - ppmThreshold.min) / (ppmThreshold.max - ppmThreshold.min || 1)) * 100, 0, 100);
  const suhuProgress = clamp(((sensorData.suhu - selectedThreshold.suhu.min) / (selectedThreshold.suhu.max - selectedThreshold.suhu.min || 1)) * 100, 0, 100);

  const ppmStats = {
    min: Math.min(...historyPpm),
    max: Math.max(...historyPpm),
    last: historyPpm[historyPpm.length - 1] ?? 0,
  };

  const suhuStats = {
    min: Math.min(...historySuhu),
    max: Math.max(...historySuhu),
    last: historySuhu[historySuhu.length - 1] ?? 0,
  };

  const ppmPoints = buildChartPoints(historyPpm);
  const suhuPoints = buildChartPoints(historySuhu);
  const ppmAreaPath = buildAreaPath(historyPpm);
  const suhuAreaPath = buildAreaPath(historySuhu);

  return (
    <div className="iot-panel" style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #07111f 0%, #111827 25%, #0b132c 55%, #09263c 100%)',
      backgroundImage: 'radial-gradient(circle at top, rgba(34, 211, 238, 0.12), transparent 38%), linear-gradient(135deg, #07111f 0%, #111827 25%, #0b132c 55%, #09263c 100%)',
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      padding: '24px',
      color: '#ffffff',
      position: 'relative',
      overflow: 'hidden'
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
          <div className="status-pill" style={{
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

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div className="dashboard-controls">
            <div className="control-group">
              <label className="control-label" htmlFor="crop-select">Tanaman</label>
            <select
              id="crop-select"
              className="dashboard-select"
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value as 'selada' | 'pakcoy' | 'tandon_bersama')}
            >
              <option value="selada">Selada</option>
              <option value="pakcoy">Pakcoy</option>
              <option value="tandon_bersama">Tandon bersama (Selada + Pakcoy)</option>
            </select>
            </div>
            <div className="control-group">
              <label className="control-label" htmlFor="phase-select">Fase tumbuh</label>
            <select
              id="phase-select"
              className="dashboard-select"
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value as 'semai' | 'vegetatif' | 'utama')}
            >
              {Object.entries(growthPhaseLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            </div>
            <div className="control-group">
              <label className="control-label" htmlFor="tds-scale">Skala TDS</label>
            <select
              id="tds-scale"
              className="dashboard-select"
              value={ppmScale}
              onChange={(e) => setPpmScale(Number(e.target.value) as 500 | 700)}
            >
              <option value={500}>500 (NaCl)</option>
              <option value={700}>700 (442)</option>
            </select>
            </div>
          </div>
        </div>
          <p title="PPM dihitung dari EC menggunakan skala TDS yang dipilih. Kisaran fase awal adalah ramp perkiraan; rentang fase utama mengacu pada panduan OSU Extension." style={{ margin: '-12px 0 24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', lineHeight: 1.7 }}>
            {cropLabels[selectedCrop]} · {growthPhaseLabels[selectedPhase]} · EC {selectedThreshold.ec.min.toFixed(1)}–{selectedThreshold.ec.max.toFixed(1)} mS/cm · {ppmThreshold.min}–{ppmThreshold.max} PPM (skala {ppmScale}) · suhu larutan {selectedThreshold.suhu.min}–{selectedThreshold.suhu.max}°C.
            <br />Fase semai/vegetatif adalah ramp bertahap, bukan rentang fase yang diuji langsung. {selectedCrop === 'tandon_bersama' ? 'Tandon bersama memakai rentang kompromi; usahakan fase tumbuh kedua tanaman berdekatan. ' : ''}
            Acuan EC fase utama dan suhu: <a href="https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics.html" target="_blank" rel="noreferrer" style={{ color: '#67e8f9', textDecoration: 'underline' }}>Oklahoma State University Extension (HLA-6722)</a>. Studi pada kultivar pakcoy Shanghaiqing melaporkan performa baik pada EC 1,8–2,4 mS/cm: <a href="https://doi.org/10.1371/journal.pone.0202090" target="_blank" rel="noreferrer" style={{ color: '#67e8f9', textDecoration: 'underline' }}>Ding et al. (2018), PLOS ONE</a>.
          </p>

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
            <p key={`ppm-${sensorData.ppm}-${sensorData.tanggal_update ?? 'n'}`} className="metric-value" style={{ margin: '0', fontSize: '36px', fontWeight: '700', color: '#06b6d4' }}>
              {sensorData.ppm}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>Parts Per Million</p>

            <div style={{ marginTop: '12px' }}>
              <span title={`Status PPM ${ppmStatus}; kisaran ${ppmThreshold.min}–${ppmThreshold.max} PPM untuk ${cropLabels[selectedCrop]}, ${growthPhaseLabels[selectedPhase]}.`} aria-label={`Status PPM ${ppmStatus}`} style={{ ...getStatusStyle(ppmStatus), display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                ● PPM {ppmStatus}
              </span>
            </div>

            <div style={{ marginTop: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', color: '#cbd5e1' }}>
                <span>Range {ppmThreshold.min}-{ppmThreshold.max} PPM</span>
                <span>{Math.round(ppmProgress)}%</span>
              </div>
              <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(125, 211, 252, 0.2)', overflow: 'hidden' }}>
                <div className="gauge-fill" style={{
                  width: `${ppmProgress}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #22d3ee 0%, #67e8f9 35%, #a5f3fc 100%)',
                  boxShadow: '0 0 16px rgba(34, 211, 238, 0.45)',
                  transition: 'width 700ms ease'
                }} />
              </div>
            </div>
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
            <p key={`suhu-${sensorData.suhu}-${sensorData.tanggal_update ?? 'n'}`} className="metric-value" style={{ margin: '0', fontSize: '36px', fontWeight: '700', color: '#3b82f6' }}>
              {sensorData.suhu}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>Derajat Celsius</p>

            <div style={{ marginTop: '12px' }}>
              <span title={`Status suhu larutan ${suhuStatus}; kisaran ${selectedThreshold.suhu.min}–${selectedThreshold.suhu.max}°C untuk ${cropLabels[selectedCrop]}, ${growthPhaseLabels[selectedPhase]}.`} aria-label={`Status suhu larutan ${suhuStatus}`} style={{ ...getStatusStyle(suhuStatus), display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                ● Suhu {suhuStatus}
              </span>
            </div>

            <div style={{ marginTop: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', color: '#cbd5e1' }}>
                <span>Range {selectedThreshold.suhu.min}-{selectedThreshold.suhu.max}°C</span>
                <span>{Math.round(suhuProgress)}%</span>
              </div>
              <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(147, 197, 253, 0.2)', overflow: 'hidden' }}>
                <div className="gauge-fill" style={{
                  width: `${suhuProgress}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #60a5fa 0%, #93c5fd 35%, #bfdbfe 100%)',
                  boxShadow: '0 0 16px rgba(96, 165, 250, 0.45)',
                  transition: 'width 700ms ease'
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Grafik Sensor PPM dan Suhu Air */}
        <div style={{
          marginBottom: '32px',
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 118, 110, 0.15) 100%)',
          borderRadius: '18px',
          border: '1px solid rgba(94, 234, 212, 0.25)',
          boxShadow: '0 20px 45px rgba(15, 118, 110, 0.18)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', color: '#67e8f9' }}>IoT Trend</p>
              <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#e2e8f0' }}>Nutrisi & Suhu Air</h3>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#e2e8f0' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34,211,238,0.08)', padding: '6px 10px', borderRadius: '999px', border: '1px solid rgba(34,211,238,0.2)' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22d3ee', display: 'inline-block' }}></span>PPM</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(96,165,250,0.08)', padding: '6px 10px', borderRadius: '999px', border: '1px solid rgba(96,165,250,0.2)' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }}></span>Suhu</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            <div style={{ padding: '16px', borderRadius: '14px', border: '1px solid rgba(34,211,238,0.18)', background: 'rgba(15,23,42,0.55)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                <span>PPM</span>
                <span>20 sample</span>
              </div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '170px', display: 'block', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                {[20, 40, 60, 80].map((lineY) => (
                  <line key={lineY} x1="0" y1={lineY} x2="100" y2={lineY} stroke="rgba(148, 163, 184, 0.18)" strokeWidth="0.5" />
                ))}
                <path d={ppmAreaPath} fill="rgba(34, 211, 238, 0.18)" stroke="none" />
                <polyline key={`ppm-chart-${ppmPoints}`} className="chart-line" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={ppmPoints} />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '10px', flexWrap: 'wrap', color: '#cbd5e1', fontSize: '12px' }}>
                <span>Min: <strong style={{ color: '#67e8f9' }}>{ppmStats.min}</strong></span>
                <span>Max: <strong style={{ color: '#67e8f9' }}>{ppmStats.max}</strong></span>
                <span>Now: <strong style={{ color: '#67e8f9' }}>{ppmStats.last}</strong></span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '14px', border: '1px solid rgba(96,165,250,0.18)', background: 'rgba(15,23,42,0.55)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                <span>Suhu</span>
                <span>20 sample</span>
              </div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '170px', display: 'block', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                {[20, 40, 60, 80].map((lineY) => (
                  <line key={lineY} x1="0" y1={lineY} x2="100" y2={lineY} stroke="rgba(148, 163, 184, 0.18)" strokeWidth="0.5" />
                ))}
                <path d={suhuAreaPath} fill="rgba(96, 165, 250, 0.2)" stroke="none" />
                <polyline key={`suhu-chart-${suhuPoints}`} className="chart-line" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={suhuPoints} />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '10px', flexWrap: 'wrap', color: '#cbd5e1', fontSize: '12px' }}>
                <span>Min: <strong style={{ color: '#93c5fd' }}>{suhuStats.min}°C</strong></span>
                <span>Max: <strong style={{ color: '#93c5fd' }}>{suhuStats.max}°C</strong></span>
                <span>Now: <strong style={{ color: '#93c5fd' }}>{suhuStats.last}°C</strong></span>
              </div>
            </div>
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
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes chartGlow {
          0% {
            filter: drop-shadow(0 0 0 rgba(34, 211, 238, 0));
            stroke-dasharray: 1000;
            stroke-dashoffset: 1000;
          }
          15% {
            filter: drop-shadow(0 0 10px rgba(34, 211, 238, 0.35));
          }
          100% {
            filter: drop-shadow(0 0 12px rgba(34, 211, 238, 0.45));
            stroke-dasharray: 1000;
            stroke-dashoffset: 0;
          }
        }

        @keyframes valuePulse {
          0% {
            opacity: 0.35;
            transform: translateY(8px) scale(0.96);
          }
          35% {
            opacity: 1;
            transform: translateY(-2px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .iot-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
          background-size: 26px 26px;
          pointer-events: none;
        }

        .iot-panel > * {
          position: relative;
          z-index: 1;
        }

        .iot-panel {
          animation: floatIn 0.5s ease-out;
        }

        .chart-line {
          animation: chartGlow 1.8s ease-out forwards;
        }

        .status-pill {
          animation: floatIn 0.4s ease-out;
        }

        .metric-value {
          animation: valuePulse 0.7s ease-out;
        }

        .gauge-fill {
          animation: pulse 2.2s ease-in-out infinite;
        }

        .dashboard-controls {
          width: min(100%, 900px);
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          padding: 16px;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 12px;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }

        .control-group {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .control-label {
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
        }

        .dashboard-select {
          width: 100%;
          min-height: 48px;
          padding: 10px 12px;
          color: #f8fafc;
          background-color: #0f172a;
          border: 1px solid rgba(34, 211, 238, 0.55);
          border-radius: 8px;
          font: inherit;
          font-size: 16px;
          line-height: 1.35;
          color-scheme: dark;
        }

        .dashboard-select option {
          color: #f8fafc;
          background-color: #0f172a;
        }

        @media (max-width: 640px) {
          .dashboard-controls {
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
            padding: 14px;
          }
        }
      `}</style>
    </div>
  );
}
