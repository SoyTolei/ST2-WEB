// Download de arquivo via Base64
window.downloadFile = function (filename, base64Content) {
    try {
        const link = document.createElement('a');
        link.download = filename;
        link.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64Content;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('✅ Download iniciado:', filename);
    } catch (error) {
        console.error('❌ Erro ao baixar arquivo:', error);
        alert('Erro ao iniciar download. Verifique o console.');
    }
};
// ── Aura FAQ ──
window.scrollToBottom = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollTop = el.scrollHeight;
};

window.downloadFileFromBase64 = (fileName, base64) => {
    const a = document.createElement('a');
    a.download = fileName;
    a.href = 'data:application/octet-stream;base64,' + base64;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};