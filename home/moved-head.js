// home/index.html, in <head>: a browser tab goes straight on to aOS (its own file: the site's CSP header allows no inline scripts).
// a browser tab: straight on to aOS
if (!(matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)) location.replace('../aOS/');
