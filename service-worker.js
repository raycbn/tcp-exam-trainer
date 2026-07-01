const CACHE_NAME = "tcp-trainer-v9";

const STATIC_FILES = [
    "./",

    // Páginas
    "./index.html",
    "./practice.html",
    "./exam.html",
    "./review.html",
    "./favorites.html",
    "./smart.html",

    // CSS
    "./css/styles.css",

    // JS
    "./js/app.js",
    "./js/stats.js",

    // Configuración
    "./manifest.json",
    "./version.json",

    // Iconos PWA
    "./icons/icon-192.png",
    "./icons/icon-512.png",

    // Logo
    "./images/elite_aircrew_logo_horizontal_1tinta_positivo_SIN_TAGLINE.png"
];


// =========================
// INSTALL
// =========================

self.addEventListener("install", event => {

    self.skipWaiting();

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_FILES))

    );

});


// =========================
// ACTIVATE
// =========================

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()

            .then(keys =>

                Promise.all(

                    keys.map(key => {

                        if (key !== CACHE_NAME) {

                            console.log("Eliminando caché:", key);

                            return caches.delete(key);

                        }

                    })

                )

            )

            .then(() => self.clients.claim())

    );

});


// =========================
// FETCH
// =========================

self.addEventListener("fetch", event => {

    const url = event.request.url;


    // =========================
    // QUESTIONS.JSON
    // Siempre desde Internet
    // =========================

    if (url.includes("questions.json")) {

        event.respondWith(

            fetch(event.request, {
                cache: "no-store"
            })

        );

        return;

    }


    // =========================
    // HTML / CSS / JS
    // Network First
    // =========================

    if (

        url.endsWith(".html") ||
        url.endsWith(".css") ||
        url.endsWith(".js")

    ) {

        event.respondWith(

            fetch(event.request, {
                cache: "no-store"
            })

            .then(response => {

                const clone = response.clone();

                caches.open(CACHE_NAME)
                    .then(cache => {

                        cache.put(
                            event.request,
                            clone
                        );

                    });

                return response;

            })

            .catch(() =>
                caches.match(event.request)
            )

        );

        return;

    }


    // =========================
    // Imágenes
    // Cache First
    // =========================

    if (

        event.request.destination === "image"

    ) {

        event.respondWith(

            caches.match(event.request)

                .then(response => {

                    return response ||

                        fetch(event.request)

                        .then(networkResponse => {

                            const clone =
                                networkResponse.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {

                                    cache.put(
                                        event.request,
                                        clone
                                    );

                                });

                            return networkResponse;

                        });

                })

        );

        return;

    }


    // =========================
    // Resto de recursos
    // Cache First
    // =========================

    event.respondWith(

        caches.match(event.request)

            .then(response => {

                return response ||

                    fetch(event.request);

            })

    );

});
