
const FAVORITES_KEY = "tcp_favorites";

function loadFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function renderFavorites() {
    const list = document.getElementById("favoritesList");
    if (!list) return;

    const favorites = loadFavorites();

    if (!favorites.length) {
        list.innerHTML = `
            <div class="dashboard-panel favorite-empty">
                <h2>No tienes favoritas todavía</h2>
                <p>Marca preguntas difíciles desde el modo de estudio para guardarlas aquí y repasarlas después.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = "";

    favorites.forEach(question => {
        const card = document.createElement("article");
        card.className = "dashboard-panel favorite-card";

        card.innerHTML = `
            <div class="favorite-card-top">
                <div>
                    <div class="favorite-topic">${(question.topic || "General").toUpperCase()}</div>
                    <h2>${question.question}</h2>
                </div>

                <button class="favorite-btn is-favorite favorite-remove" data-id="${question.id}">
                    <span class="favorite-star">★</span>
                    <span>Quitar</span>
                </button>
            </div>

            ${question.image ? `
                <div class="favorite-image-container">
                    <img class="favorite-image" src="${question.image}" alt="${question.question}">
                </div>
            ` : ""}
        `;

        list.appendChild(card);
    });

    list.querySelectorAll(".favorite-remove").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.getAttribute("data-id");
            const updated = loadFavorites().filter(q => String(q.id) !== String(id));
            saveFavorites(updated);
            renderFavorites();
        });
    });
}

document.addEventListener("DOMContentLoaded", renderFavorites);
