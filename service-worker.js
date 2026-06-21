const CACHE_NAME = "tcp-trainer-v1";

const urlsToCache = [
    "./",
    "./index.html",
    "./css/styles.css",
    "./js/app.js",
    "./js/stats.js",
    "./data/questions.json",
    "./manifest.json"
];

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches.open(CACHE_NAME)
                .then(cache =>
                    cache.addAll(urlsToCache)
                )
        );
    }
);

self.addEventListener(
    "fetch",
    event => {

        event.respondWith(

            caches.match(
                event.request
            )
            .then(response =>
                response ||
                fetch(event.request)
            )
        );
    }
);
