// Bind after either initial scan rendering or candidate-filter rendering.
function bindCandidateActions() {
  $$('.candidate').forEach(card => {
    card.onclick = event => {
      if (event.target.closest('input,button,a')) return;
      profileCandidate(card);
    };
    card.onkeydown = event => {
      if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      profileCandidate(card);
    };
    card.querySelector('.cand-check').onclick = event => event.stopPropagation();
    card.querySelectorAll('.candidate-token').forEach(button => {
      button.onclick = event => {
        event.stopPropagation();
        openToken(button.dataset.token, button.dataset.chain);
      };
    });
  });
}

async function profileCandidate(card) {
  if (card.getAttribute('aria-busy') === 'true' || state.profileAbort) return;
  card.setAttribute('aria-busy', 'true');
  card.setAttribute('aria-disabled', 'true');
  card.querySelector('.candidate-loading').hidden = false;
  try {
    await profileSelectedSafe([card.dataset.address]);
  } finally {
    card.removeAttribute('aria-busy');
    card.removeAttribute('aria-disabled');
    card.querySelector('.candidate-loading').hidden = true;
  }
}
