/* ===== Suara (dibuat langsung dengan Web Audio, tanpa file audio) ===== */
let audio = null;          // { c: AudioContext, m: master gain, buf: buffer noise }
let suaraNyala = true;
try { if (localStorage.getItem('suara') === 'off') suaraNyala = false; } catch (e) {}

function bangunAudio(c) {
    const m = c.createGain();
    m.gain.value = 0.9;
    const kompresor = c.createDynamicsCompressor(); // supaya suara tidak pecah
    m.connect(kompresor);
    kompresor.connect(c.destination);

    const panjang = Math.floor(c.sampleRate * 0.3);
    const buf = c.createBuffer(1, panjang, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < panjang; i++) data[i] = Math.random() * 2 - 1;
    return { c, m, buf };
}

// Browser hanya mengizinkan suara setelah pengunjung klik / ketik / sentuh sekali
function siapkanAudio() {
    if (!audio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audio = bangunAudio(new AC());
    }
    if (audio.c.state === 'suspended') audio.c.resume();
    return audio;
}

['pointerdown', 'keydown', 'touchstart'].forEach((e) =>
    document.addEventListener(e, siapkanAudio, { passive: true })
);

function bisaBunyi() {
    return suaraNyala && audio && audio.c.state === 'running';
}

// Ledakan noise pendek yang difilter (untuk bagian "klik/tik")
function noise(a, t, dur, tipe, freq, q, gain) {
    const s = a.c.createBufferSource();
    s.buffer = a.buf;
    const f = a.c.createBiquadFilter();
    f.type = tipe; f.frequency.value = freq; f.Q.value = q;
    const g = a.c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(a.m);
    s.start(t, Math.random() * 0.1, dur + 0.01);
}

// Nada yang turun cepat (untuk bagian "bodi/thump")
function nada(a, t, f0, f1, dur, gain, tipe = 'sine') {
    const o = a.c.createOscillator();
    o.type = tipe;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = a.c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.m);
    o.start(t); o.stop(t + dur + 0.02);
}

// Suara shutter kamera: "klik-klak" (tirai membuka lalu menutup)
function sintesisShutter(a, t) {
    nada(a, t, 160, 70, 0.08, 0.3);
    noise(a, t, 0.03, 'highpass', 2500, 0.7, 0.5);
    noise(a, t, 0.05, 'bandpass', 900, 1.2, 0.35);
    nada(a, t, 1800, 400, 0.03, 0.2, 'triangle');

    const t2 = t + 0.06;
    noise(a, t2, 0.04, 'highpass', 1800, 0.7, 0.4);
    nada(a, t2, 1100, 250, 0.05, 0.22, 'triangle');
}

// Suara keyboard mekanik "thocky": bodi dalam + tik pendek
// (sekarang hanya dipakai oleh tombol Suara ON/OFF)
function sintesisThock(a, t, kuat = 1) {
    const v = 0.92 + Math.random() * 0.16; // sedikit acak biar tidak monoton
    nada(a, t, 260 * v, 95 * v, 0.11, 0.7 * kuat);
    nada(a, t, 140 * v, 70 * v, 0.16, 0.45 * kuat);
    noise(a, t, 0.025, 'lowpass', 1800, 0.7, 0.35 * kuat);
    noise(a, t, 0.012, 'bandpass', 3200, 1, 0.12 * kuat);
    noise(a, t + 0.018, 0.03, 'lowpass', 700, 0.7, 0.3 * kuat); // bottom-out
}

function shutter() {
    if (bisaBunyi()) sintesisShutter(audio, audio.c.currentTime);
}

function thock(kuat = 1) {
    if (bisaBunyi()) sintesisThock(audio, audio.c.currentTime, kuat);
}

/* Tombol nyala/mati suara */
const tombolSuara = document.getElementById('tombol-suara');

function perbaruiTombol() {
    tombolSuara.textContent = 'Suara: ' + (suaraNyala ? 'ON' : 'OFF');
    tombolSuara.setAttribute('aria-pressed', String(suaraNyala));
}

tombolSuara.addEventListener('click', () => {
    suaraNyala = !suaraNyala;
    try { localStorage.setItem('suara', suaraNyala ? 'on' : 'off'); } catch (e) {}
    perbaruiTombol();
    if (suaraNyala) {
        const a = siapkanAudio();
        if (a) a.c.resume().then(() => thock(1));
    }
});

perbaruiTombol();

/* ===== Efek kedip judul ===== */
// Kata-kata sudah dipisah di HTML (span.kata), jadi gaya tebal/tipis tetap terjaga
const kata = Array.from(document.querySelectorAll('.hero h1 .kata'));

function kedip(el, jumlah = 2, durasi = 250) {
    // satu suara shutter untuk setiap kedipan
    for (let i = 0; i < jumlah; i++) setTimeout(shutter, i * durasi);

    return el.animate(
        [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
        { duration: durasi, iterations: jumlah }
    ).finished;
}

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
const acak = (min, max) => Math.random() * (max - min) + min;

async function mulai() {
    // Tahap 1: bergiliran dari kiri ke kanan
    for (const k of kata) {
        await kedip(k, 2, 250);
    }

    await tunggu(300);

    // Tahap 2: kedip acak
    for (let i = 0; i < 12; i++) {
        const k = kata[Math.floor(Math.random() * kata.length)];
        kedip(k, 1, acak(100, 300));
        await tunggu(acak(80, 250));
    }

    // Tahap 3: selesai, semua kata tetap terlihat
}

mulai();

/* ===== Navbar: background hijau mengikuti kursor ===== */
const navbar = document.querySelector('.navbar');
const links = navbar.querySelectorAll('a');

const highlight = document.createElement('div');
highlight.className = 'nav-highlight';
navbar.appendChild(highlight);

let linkSekarang = links[0];

function pindahKe(link) {
    linkSekarang = link;

    const n = navbar.getBoundingClientRect();
    const l = link.getBoundingClientRect();

    highlight.style.width = l.width + 'px';
    highlight.style.height = l.height + 'px';
    highlight.style.transform =
        `translate(${l.left - n.left}px, ${l.top - n.top}px)`;

    links.forEach((a) => a.classList.remove('aktif'));
    link.classList.add('aktif');
}

// Link yang sedang aktif sesuai halaman yang terlihat
let indexAktif = 0;

function posisiAwal() {
    highlight.style.transition = 'none';
    pindahKe(links[indexAktif]);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => (highlight.style.transition = ''));
    });
}

// Hitung setelah font selesai dimuat agar posisi pill tepat
window.addEventListener('load', posisiAwal);

links.forEach((link) => {
    link.addEventListener('mouseenter', () => pindahKe(link));
});

// Kembali ke halaman yang sedang aktif saat kursor keluar navbar
navbar.addEventListener('mouseleave', () => pindahKe(links[indexAktif]));

window.addEventListener('resize', posisiAwal);

/* ===== Scroll: pill hijau berpindah mengikuti halaman (Home -> About Me -> Connect) ===== */
const halaman = Array.from(links).map((a) => document.getElementById(a.dataset.target));

function cekHalaman() {
    // garis acuan: 40% dari atas layar
    const garis = window.innerHeight * 0.4;
    let baru = 0;
    halaman.forEach((h, i) => {
        if (h.getBoundingClientRect().top <= garis) baru = i;
    });
    // sudah mentok di bawah -> halaman terakhir
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        baru = halaman.length - 1;
    }
    if (baru !== indexAktif) {
        indexAktif = baru;
        if (!navbar.matches(':hover')) pindahKe(links[indexAktif]);
    }
}

window.addEventListener('scroll', cekHalaman, { passive: true });
window.addEventListener('load', cekHalaman);

/* ===== Muncul halus saat halaman masuk layar ===== */
const pengamat = new IntersectionObserver((entri) => {
    entri.forEach((e) => {
        if (e.isIntersecting) {
            e.target.classList.add('tampil');
            pengamat.unobserve(e.target);
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((el) => pengamat.observe(el));

/* ===== Gambar Ben, Foto 1 & Foto 2 bergerak mengitari nama ===== */
const orbit = document.getElementById('orbit');
const judul = orbit.querySelector('h1');
const gambar = Array.from(orbit.querySelectorAll('.mengitari'));

const KECEPATAN = 0.175;     // putaran per detik (makin besar makin cepat)
let sudut0 = 0;
let terakhir = performance.now();

function gambarOrbit(waktu) {
    const dt = (waktu - terakhir) / 1000;
    terakhir = waktu;
    sudut0 += dt * KECEPATAN * Math.PI * 2; // selalu bergerak, tidak pernah berhenti

    const o = orbit.getBoundingClientRect();
    const t = judul.getBoundingClientRect();
    const ukuran = gambar[0].offsetWidth;

    // pusat = tengah tulisan nama
    const cx = t.left - o.left + t.width / 2;
    const cy = t.top - o.top + t.height / 2;

    // dibuat lebih lebar dari tulisan supaya gambar benar-benar MENGITARI nama
    const rx = t.width / 2 + ukuran * 0.55;
    const ry = t.height / 2 + ukuran * 0.6;

    gambar.forEach((img, i) => {
        const a = sudut0 + (i * Math.PI * 2) / gambar.length;
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry;

        // sin(a) > 0 = bagian depan (bawah), < 0 = bagian belakang (atas)
        const kedalaman = Math.sin(a);
        const skala = 0.85 + 0.2 * kedalaman;      // depan sedikit lebih besar

        img.style.transform =
            `translate(${x - ukuran / 2}px, ${y - ukuran / 2}px) scale(${skala})`;
        img.style.zIndex = kedalaman > 0 ? 10 : 1; // depan di atas teks, belakang di bawah teks
        img.style.opacity = 0.75 + 0.25 * ((kedalaman + 1) / 2);
    });

    requestAnimationFrame(gambarOrbit);
}

// Mulai setelah font & gambar siap supaya ukuran tulisan sudah tepat
window.addEventListener('load', () => {
    terakhir = performance.now();
    requestAnimationFrame(gambarOrbit);
});

/* ===== Kucing di halaman 3 bisa digeser dengan kursor / jari ===== */
const kucing = document.getElementById('kucing');
const halamanConnect = document.getElementById('connect');

if (kucing && halamanConnect) {
    let geser = null; // { dx, dy } selisih antara kursor dan pojok kucing

    kucing.addEventListener('pointerdown', (e) => {
        const k = kucing.getBoundingClientRect();
        const h = halamanConnect.getBoundingClientRect();

        // ganti posisi dari "right" ke "left" supaya mudah dihitung
        kucing.style.left = (k.left - h.left) + 'px';
        kucing.style.top = (k.top - h.top) + 'px';
        kucing.style.right = 'auto';

        geser = { dx: e.clientX - k.left, dy: e.clientY - k.top };
        kucing.setPointerCapture(e.pointerId);
        kucing.classList.add('digeser');
        e.preventDefault();
    });

    kucing.addEventListener('pointermove', (e) => {
        if (!geser) return;
        const h = halamanConnect.getBoundingClientRect();
        const maxX = halamanConnect.clientWidth - kucing.offsetWidth;
        const maxY = halamanConnect.clientHeight - kucing.offsetHeight;
        const x = Math.min(Math.max(e.clientX - h.left - geser.dx, 0), maxX);
        const y = Math.min(Math.max(e.clientY - h.top - geser.dy, 0), maxY);
        kucing.style.left = x + 'px';
        kucing.style.top = y + 'px';
    });

    const lepas = () => {
        geser = null;
        kucing.classList.remove('digeser');
    };
    kucing.addEventListener('pointerup', lepas);
    kucing.addEventListener('pointercancel', lepas);
}