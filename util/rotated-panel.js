// On narrow portrait screens the synth panel is shown rotated -90° so the keyboard runs along
// the long side of a phone held in portrait. A CSS transform does not change layout
// size, so the stage around the panel reserves the rotated box explicitly (and scales
// the panel down when it is wider than the screen).
export function fitRotatedPanel(stage, panel, query = '(max-width: 768px) and (orientation: portrait)') {
    const media = window.matchMedia(query);

    const update = () => {
        if (!media.matches) {
            stage.style.width = '';
            stage.style.height = '';
            panel.style.transform = '';
            return;
        }
        const width = panel.offsetWidth;   // layout size, unaffected by the transform
        const height = panel.offsetHeight;
        const parent = getComputedStyle(stage.parentElement);
        const available = stage.parentElement.clientWidth
            - parseFloat(parent.paddingLeft) - parseFloat(parent.paddingRight);
        const scale = Math.min(1, available / height);
        stage.style.width = `${height * scale}px`;
        stage.style.height = `${width * scale}px`;
        panel.style.transform = `translateY(${width * scale}px) rotate(-90deg) scale(${scale})`;
    };

    // Watch the panel (fonts loading can resize it) and the window; not the parent, whose
    // height follows the stage and would re-trigger the observer.
    new ResizeObserver(update).observe(panel);
    window.addEventListener('resize', update);
    media.addEventListener('change', update);
    update();
}
