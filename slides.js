const slides = [...document.querySelectorAll('.slide')];
const counter = document.getElementById('slideCounter');
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const fullscreen = document.getElementById('fullscreen');
let current = 0;

function renderSlide(index) {
  current = (index + slides.length) % slides.length;
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === current;
    slide.hidden = !active;
    slide.classList.toggle('slide-active', active);
  });
  counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  previous.disabled = current === 0;
  next.disabled = current === slides.length - 1;
}

previous.addEventListener('click', () => renderSlide(current - 1));
next.addEventListener('click', () => renderSlide(current + 1));

document.querySelectorAll('.open-demo').forEach((button) => {
  button.addEventListener('click', () => window.open('/', 'mvp-reality-check-demo'));
});

fullscreen.addEventListener('click', async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key === 'ArrowRight' || event.key === ' ') {
    event.preventDefault();
    if (current < slides.length - 1) renderSlide(current + 1);
  }
  if (event.key === 'ArrowLeft' && current > 0) {
    event.preventDefault();
    renderSlide(current - 1);
  }
  if (event.key.toLowerCase() === 'f') fullscreen.click();
});

renderSlide(0);
