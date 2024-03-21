function formatTanggalIndonesia(tanggalISO) {
    const date = new Date(tanggalISO);
    const options = { day: '2-digit', month: 'long', year: 'numeric' };

    return date.toLocaleDateString('id-ID', options);
}

function getDiffInDays(date) {
    const today = new Date();
    const day = new Date(date)
    return day.getDate() - today.getDate()
}

module.exports = {
    formatTanggalIndonesia, getDiffInDays
}