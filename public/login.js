const form = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorBox = document.getElementById('loginError');

const showError = (text) => {
  errorBox.textContent = text;
  errorBox.classList.add('show');
};

const clearError = () => {
  errorBox.textContent = '';
  errorBox.classList.remove('show');
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    showError('Bitte Mitarbeiter und Passwort eingeben.');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'same-origin'
    });
      if (!response.ok || !data.ok) {
        showError(data.error || 'Anmeldung fehlgeschlagen.');

    if (!response.ok || !data.success) {
      showError(data.message || 'Anmeldung fehlgeschlagen.');
      window.location.href = '/dashboard';
    }

    window.location.href = '/';
  } catch (error) {
    showError('Login konnte nicht verarbeitet werden. Bitte später erneut versuchen.');
  }
});

usernameInput.focus();
