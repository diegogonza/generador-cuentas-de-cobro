// ── Option card selection ──────────────────────────────────
function setupOptionCards(groupName) {
  const cards = document.querySelectorAll(`[data-group="${groupName}"]`);
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;

      // Special logic for price group
      if (groupName === 'price') {
        const val = radio?.value;
        const wrapper = document.getElementById('free-price-wrapper');
        if (val === 'libre') {
          wrapper.classList.add('visible');
          document.getElementById('precio_libre').required = true;
        } else {
          wrapper.classList.remove('visible');
          document.getElementById('precio_libre').required = false;
        }
      }
    });
  });
}

setupOptionCards('service');
setupOptionCards('price');

// ── Currency toggle ───────────────────────────────────────
const copBtn = document.getElementById('cop-btn');
const usdBtn = document.getElementById('usd-btn');
const copRadio = document.getElementById('cop');
const usdRadio = document.getElementById('usd');

const priceLabels = {
  cop: ['$2.000.000', '$2.500.000'],
  usd: ['USD 500.00', 'USD 625.00'],
};
const currencyDescCop = ['COP', 'COP'];
const currencyDescUsd = ['USD', 'USD'];

function updateCurrency(moneda) {
  const prefix = document.getElementById('currency-prefix');

  if (moneda === 'COP') {
    copBtn.classList.add('active');
    usdBtn.classList.remove('active');
    document.getElementById('price-a').textContent = priceLabels.cop[0];
    document.getElementById('price-b').textContent = priceLabels.cop[1];
    document.getElementById('price-a-label').textContent = 'COP';
    document.getElementById('price-b-label').textContent = 'COP';
    if (prefix) prefix.textContent = '$';
  } else {
    usdBtn.classList.add('active');
    copBtn.classList.remove('active');
    document.getElementById('price-a').textContent = priceLabels.usd[0];
    document.getElementById('price-b').textContent = priceLabels.usd[1];
    document.getElementById('price-a-label').textContent = 'USD';
    document.getElementById('price-b-label').textContent = 'USD';
    if (prefix) prefix.textContent = 'USD';
  }
}

// When the preset price values for USD are selected, we still send
// the raw number to the backend which then applies the correct currency label.
// Map: display -> raw value to send
const usdRawValues = {
  'USD 500.00': '500',
  'USD 625.00': '625',
};

copBtn.addEventListener('click', () => { copRadio.checked = true; updateCurrency('COP'); resetPriceRadioValues('COP'); });
usdBtn.addEventListener('click', () => { usdRadio.checked = true; updateCurrency('USD'); resetPriceRadioValues('USD'); });

function resetPriceRadioValues(moneda) {
  // Update the internal radio values to match currency so backend receives correct number
  const priceCards = document.querySelectorAll('[data-group="price"]');
  const copValues = ['2000000', '2500000', 'libre'];
  const usdValues = ['500', '625', 'libre'];
  priceCards.forEach((card, i) => {
    const radio = card.querySelector('input[type="radio"]');
    if (radio) {
      radio.value = moneda === 'COP' ? copValues[i] : usdValues[i];
    }
  });
}

// ── Form submission ───────────────────────────────────────
const form = document.getElementById('invoice-form');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validate free price if selected
  const libreCard = document.getElementById('libre-card');
  if (libreCard.classList.contains('selected')) {
    const val = document.getElementById('precio_libre').value.trim();
    if (!val || parseFloat(val) <= 0) {
      document.getElementById('precio_libre').focus();
      document.getElementById('precio_libre').style.borderColor = '#f87171';
      return;
    }
  }

  // Show loading
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  const originalText = submitBtn.querySelector('.btn-text').innerHTML;
  submitBtn.querySelector('.btn-text').textContent = 'Generando PDF...';

  try {
    const formData = new FormData(form);
    const response = await fetch('/generar-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    // Trigger download
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cd = response.headers.get('content-disposition') || '';
    const fnMatch = cd.match(/filename="([^"]+)"/);
    a.download = fnMatch ? fnMatch[1] : 'cuenta-de-cobro.pdf';
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Update counter display after success
    try {
      const numRes = await fetch('/current-number');
      const numData = await numRes.json();
      document.getElementById('invoice-number').textContent = numData.numero;
      submitBtn.querySelector('.btn-sub').textContent =
        `Cuenta #${numData.numero} · ${document.querySelector('.counter-date').textContent}`;
    } catch (_) {}

  } catch (err) {
    alert('❌ Error al generar el PDF: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    submitBtn.querySelector('.btn-text').innerHTML = originalText;
  }
});

// Clear custom price field error on input
document.getElementById('precio_libre').addEventListener('input', function () {
  this.style.borderColor = '';
});
