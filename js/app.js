let questions = [];
let currentQuestion = 0;

async function loadQuestions() {
try {

```
    const response = await fetch(
        './data/questions.json?ts=' + Date.now(),
        {
            cache: 'no-store'
        }
    );

    if (!response.ok) {
        throw new Error('HTTP ' + response.status);
    }

    const text = await response.text();

    if (!text.trim()) {
        throw new Error('questions.json está vacío');
    }

    questions = JSON.parse(text);

    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error(
            'questions.json no contiene un array válido de preguntas'
        );
    }

    showQuestion();

} catch (error) {

    console.error(error);

    document.getElementById('question').innerText =
        'Error cargando preguntas: ' + error.message;

    document.getElementById('counter').innerText = '';

    document.getElementById('answers').innerHTML = '';

    document.getElementById('nextBtn').style.display = 'none';
}
```

}

function showQuestion() {

```
const q = questions[currentQuestion];

document.getElementById('counter').innerText =
    `Pregunta ${currentQuestion + 1} / ${questions.length}`;

document.getElementById('question').innerText =
    q.question;

document.getElementById('topic').innerText =
    `Tema: ${q.topic}`;

const progress =
    ((currentQuestion + 1) / questions.length) * 100;

document.getElementById('progress-bar').style.width =
    progress + '%';

document.getElementById('result').innerText = '';

document.getElementById('explanation').style.display =
    'none';

document.getElementById('explanation').innerText =
    '';

const answersDiv =
    document.getElementById('answers');

answersDiv.innerHTML = '';

q.options.forEach((option, index) => {

    const btn =
        document.createElement('button');

    btn.innerText = option;

    btn.onclick = () => {

        const buttons =
            document.querySelectorAll('#answers button');

        buttons.forEach(b => {
            b.disabled = true;
            b.style.cursor = 'default';
        });

        if (index === q.correct) {

            btn.classList.add('correct');

            document.getElementById('result').innerText =
                '✅ Correcto';

        } else {

            btn.classList.add('wrong');

            buttons[q.correct].classList.add('correct');

            document.getElementById('result').innerText =
                '❌ Incorrecto';

        }

        document.getElementById('explanation').style.display =
            'block';

        document.getElementById('explanation').innerHTML =
            `<strong>Explicación:</strong><br>${q.explanation}`;

    };

    answersDiv.appendChild(btn);

});

document.getElementById('nextBtn').disabled = false;
document.getElementById('nextBtn').style.display = 'block';
```

}

document.getElementById('nextBtn').onclick = () => {

```
currentQuestion++;

if (currentQuestion >= questions.length) {
    currentQuestion = 0;
}

showQuestion();
```

};

loadQuestions();

```
```
