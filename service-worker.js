const CACHE_NAME = "tcp-trainer-v7";

const STATIC_FILES = [
    "./",
    "./index.html",
    "./favorites.html",
    "./smart.html",
    "./css/styles.css",
    "./js/app.js",
    "./js/stats.js",
    "./manifest.json",
    "./version.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];


// =========================
// INSTALL
// =========================

self.addEventListener(
    "install",
    event => {

        self.skipWaiting();

        event.waitUntil(

            caches.open(CACHE_NAME)
                .then(cache =>
                    cache.addAll(STATIC_FILES)
                )

        );

    }
);


// =========================
// ACTIVATE
// =========================

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches.keys()
                .then(keys => {

                    return Promise.all(

                        keys.map(key => {

                            if (
                                key !== CACHE_NAME
                            ) {

                                console.log(
                                    "Eliminando caché antigua:",
                                    key
                                );

                                return caches.delete(key);
                            }

                        })

                    );

                })
                .then(() =>
                    self.clients.claim()
                )

        );

    }
);


// =========================
// FETCH
// =========================

self.addEventListener(
    "fetch",
    event => {

        const url =
            event.request.url;


        // =====================
        // QUESTIONS.JSON
        // SIEMPRE DESDE RED
        // =====================

        if (
            url.includes(
                "questions.json"
            )
        ) {

            event.respondWith(

                fetch(event.request, {
                    cache: "no-store"
                })

            );

            return;
        }


        // =====================
        // HTML / CSS / JS
        // NETWORK FIRST
        // =====================

        if (

            url.endsWith(".html") ||
            url.endsWith(".css") ||
            url.endsWith(".js")

        ) {

            event.respondWith(

                fetch(event.request)

                    .then(response => {

                        const responseClone =
                            response.clone();

                        caches.open(
                            CACHE_NAME
                        )
                        .then(cache => {

                            cache.put(
                                event.request,
                                responseClone
                            );

                        });

                        return response;

                    })

                    .catch(() =>
                        caches.match(
                            event.request
                        )
                    )

            );

            return;
        }


        // =====================
        // RESTO
        // CACHE FIRST
        // =====================

        event.respondWith(

            caches.match(
                event.request
            )
            .then(response => {

                return (
                    response ||
                    fetch(
                        event.request
                    )
                );

            })

        );

    }
);
