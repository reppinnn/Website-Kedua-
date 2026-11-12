/* ===== Suara (dibuat langsung dengan Web Audio, tanpa file audio) ===== */
let audio = null;          // { c: AudioContext, m: master gain, buf: buffer noise }

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
    return audio && audio.c.state === 'running';
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

function shutter() {
    if (bisaBunyi()) sintesisShutter(audio, audio.c.currentTime);
}

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

/* ===== Kucing astronot: melayang bebas, bisa ditangkap dengan kursor / jari ===== */
const kucing = document.getElementById('kucing');
const halamanConnect = document.getElementById('connect');

if (kucing && halamanConnect) {
    const JELAJAH = 42;      // kecepatan melayang santai (px per detik)
    const MAKS_LEMPAR = 900; // batas kecepatan saat kucing dilempar

    let x = 0, y = 0;              // posisi pojok kiri-atas kucing di dalam halaman
    let vx = 0, vy = 0;            // kecepatan (px/detik)
    let rot = 0, vrot = 0;         // putaran (derajat, derajat/detik)
    let siap = false;
    let terlihat = true;
    let tertangkap = false;
    let geser = null;              // selisih kursor dengan pojok kucing
    let lacak = { x: 0, y: 0, t: 0, vx: 0, vy: 0 }; // untuk menghitung kecepatan lemparan
    let waktuLama = performance.now();

    new IntersectionObserver((e) => { terlihat = e[0].isIntersecting; }).observe(halamanConnect);

    const batas = () => ({
        maxX: Math.max(0, halamanConnect.clientWidth - kucing.offsetWidth),
        maxY: Math.max(0, halamanConnect.clientHeight - kucing.offsetHeight),
    });
    const jepit = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

    function terapkan(waktu) {
        // sedikit naik-turun supaya terasa tanpa gravitasi
        const goyang = tertangkap ? 0 : Math.sin(waktu / 900) * 6;
        const skala = tertangkap ? 1.1 : 1;
        kucing.style.transform =
            `translate(${x}px, ${y + goyang}px) rotate(${rot}deg) scale(${skala})`;
    }

    function awal() {
        const { maxX } = batas();
        x = maxX - 20;
        y = 130;
        const arah = Math.random() * Math.PI * 2;
        vx = Math.cos(arah) * JELAJAH;
        vy = Math.sin(arah) * JELAJAH;
        vrot = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 10);
        rot = 8;
        siap = true;
    }

    function putar(waktu) {
        const dt = Math.min((waktu - waktuLama) / 1000, 0.05);
        waktuLama = waktu;

        if (!siap && kucing.offsetWidth > 0 && kucing.offsetHeight > 0) awal();

        if (siap && terlihat && !tertangkap) {
            const { maxX, maxY } = batas();
            x += vx * dt;
            y += vy * dt;
            rot += vrot * dt;

            // memantul pelan di tepi halaman
            if (x < 0)    { x = 0;    vx =  Math.abs(vx); vrot = -vrot * 0.9; }
            if (x > maxX) { x = maxX; vx = -Math.abs(vx); vrot = -vrot * 0.9; }
            if (y < 0)    { y = 0;    vy =  Math.abs(vy); }
            if (y > maxY) { y = maxY; vy = -Math.abs(vy); }

            // setelah dilempar, perlahan kembali ke kecepatan melayang santai
            const laju = Math.hypot(vx, vy) || 1;
            const baru = laju + (JELAJAH - laju) * Math.min(1, dt * 1.2);
            vx *= baru / laju;
            vy *= baru / laju;

            // putaran juga kembali tenang
            const tenang = Math.sign(vrot || 1) * 14;
            vrot += (tenang - vrot) * Math.min(1, dt * 0.8);
        }

        if (siap) terapkan(waktu);
        requestAnimationFrame(putar);
    }
    requestAnimationFrame(putar);

    // ---- Menangkap kucing ----
    kucing.addEventListener('pointerdown', (e) => {
        const h = halamanConnect.getBoundingClientRect();
        // posisi sebenarnya (tanpa goyangan & putaran) diambil dari x, y
        geser = { dx: e.clientX - h.left - x, dy: e.clientY - h.top - y };
        tertangkap = true;
        vx = vy = 0;
        lacak = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0 };
        kucing.setPointerCapture(e.pointerId);
        kucing.classList.add('digeser');
        e.preventDefault();
    });

    kucing.addEventListener('pointermove', (e) => {
        if (!tertangkap) return;
        const h = halamanConnect.getBoundingClientRect();
        const { maxX, maxY } = batas();
        x = jepit(e.clientX - h.left - geser.dx, 0, maxX);
        y = jepit(e.clientY - h.top - geser.dy, 0, maxY);

        // hitung kecepatan kursor (diperhalus) untuk lemparan
        const sekarang = performance.now();
        const dt = (sekarang - lacak.t) / 1000;
        if (dt > 0.001) {
            lacak.vx = lacak.vx * 0.6 + ((e.clientX - lacak.x) / dt) * 0.4;
            lacak.vy = lacak.vy * 0.6 + ((e.clientY - lacak.y) / dt) * 0.4;
            lacak.x = e.clientX; lacak.y = e.clientY; lacak.t = sekarang;
        }
    });

    const lepas = () => {
        if (!tertangkap) return;
        tertangkap = false;
        kucing.classList.remove('digeser');
        // kalau kursor sempat diam sebelum dilepas, kucing tidak ikut terlempar
        const diam = (performance.now() - lacak.t) > 120;
        let lx = diam ? 0 : lacak.vx;
        let ly = diam ? 0 : lacak.vy;
        const laju = Math.hypot(lx, ly);
        if (laju > MAKS_LEMPAR) { lx *= MAKS_LEMPAR / laju; ly *= MAKS_LEMPAR / laju; }
        // dilepas pelan -> tetap melayang santai ke arah terakhir
        if (laju < JELAJAH) {
            const a = laju > 1 ? Math.atan2(ly, lx) : Math.random() * Math.PI * 2;
            lx = Math.cos(a) * JELAJAH; ly = Math.sin(a) * JELAJAH;
        }
        vx = lx; vy = ly;
        vrot = jepit(lx * 0.15, -240, 240) || 14;
        waktuLama = performance.now();
        geser = null;
    };
    kucing.addEventListener('pointerup', lepas);
    kucing.addEventListener('pointercancel', lepas);
}
