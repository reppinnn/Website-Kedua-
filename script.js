/* ===== Efek kedip judul ===== */
// Kata-kata sudah dipisah di HTML (span.kata), jadi gaya tebal/tipis tetap terjaga
const kata = Array.from(document.querySelectorAll('.hero h1 .kata'));

function kedip(el, jumlah = 2, durasi = 250) {
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

function pindahKe(link) {
    const n = navbar.getBoundingClientRect();
    const l = link.getBoundingClientRect();

    highlight.style.width = l.width + 'px';
    highlight.style.height = l.height + 'px';
    highlight.style.transform =
        `translate(${l.left - n.left}px, ${l.top - n.top}px)`;

    links.forEach((a) => a.classList.remove('aktif'));
    link.classList.add('aktif');
}

function posisiAwal() {
    highlight.style.transition = 'none';
    pindahKe(navbar.querySelector('a.aktif') || links[0]);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => (highlight.style.transition = ''));
    });
}

// Hitung setelah font selesai dimuat agar posisi pill tepat
window.addEventListener('load', posisiAwal);

links.forEach((link) => {
    link.addEventListener('mouseenter', () => pindahKe(link));
});

// Kembali ke Home saat kursor keluar navbar
navbar.addEventListener('mouseleave', () => pindahKe(links[0]));

window.addEventListener('resize', posisiAwal);