// Debug & Admin Console

const receiptIdInput = document.getElementById('receiptId');
const receiptResult = document.getElementById('receiptResult');
const btnFetchReceipt = document.getElementById('btnFetchReceipt');

const confirmTokenInput = document.getElementById('confirmToken');
const btnDangerButtons = document.querySelectorAll('#dbDanger .btn-danger');
const clearResult = document.getElementById('clearResult');

function setPre(el, obj) {
    el.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

btnFetchReceipt?.addEventListener('click', async () => {
    const id = (receiptIdInput.value || '').trim();
    if (!id) {
        setPre(receiptResult, 'Enter a receipt ID');
        return;
    }
    setPre(receiptResult, 'Fetching...');
    try {
        const res = await fetch(`/api/debug/etsy/receipt/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        setPre(receiptResult, data);
    } catch (err) {
        setPre(receiptResult, `Error: ${err.message}`);
    }
});

btnDangerButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
        const token = (confirmTokenInput.value || '').trim();
        if (token !== 'CONFIRM') {
            setPre(clearResult, 'Confirm token must be CONFIRM');
            return;
        }
        const action = btn.dataset.action;
        setPre(clearResult, `Running ${action}...`);
        try {
            const res = await fetch('/api/debug/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, confirm: token })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
            setPre(clearResult, data);
        } catch (err) {
            setPre(clearResult, `Error: ${err.message}`);
        }
    });
});
