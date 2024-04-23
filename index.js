const { Client, LocalAuth, MessageMedia, Contact } = require('whatsapp-web.js');
const axios = require('axios').default;
const { formatTanggalIndonesia, getDiffInDays } = require('./DateUtils')

const HOST = "http://127.0.0.1:8000/api";
const ACCESS_TOKEN = "";

const INTERVAL = 5000;

const api = axios.create({
    baseURL: HOST,
    headers: {
        Authorization: "Bearer " + ACCESS_TOKEN
    }
})

const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache:
    {
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2404.1.html',
        type: 'remote'
    }
});

const qrcode = require('qrcode-terminal');

function whatsappID(phone = "") {
    if (phone.charAt(0) === "0" || phone.charAt(0) === "+") {
        return "62" + phone.substring(1) + "@c.us"
    }
    else if (phone.charAt(0) === "6") {
        return phone + "@c.us"
    }
    else if (phone.charAt(0) === "8") {
        return "62" + phone + "@c.us"
    }
    else {
        return false
    }
}

function containsOnlyNumbers(str) {
    return /^\d+$/.test(str);
}

function generateMessage(deadline) {
    const today = new Date();
    const diffInDays = getDiffInDays(deadline)
    if (deadline.toString() === today.toISOString().split("T")[0]) {
        return `Segera kembalikan buku, waktu pengembalian pada tanggal ${formatTanggalIndonesia(deadline)}`;
    } else if (diffInDays === 3) {
        return `Segera kembalikan buku, waktu pengembalian pada tanggal ${formatTanggalIndonesia(deadline)}`;
    } else if (diffInDays === -3) {
        return `Segera kembalikan buku, waktu pengembalian telah melewati batas waktu`;
    } else {
        return "";
    }
}

function updateStatus(date) {
    const today = new Date();
    const diffInDays = getDiffInDays(date)
    if (date.toString() === today.toISOString().split("T")[0]) {
        return "3_day_after"
    } else if (diffInDays === 3) {
        return "today"
    } else if (diffInDays === -3) {
        return "done"
    }
}
// Listener Whatsapp
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});


client.on('ready', () => {
    console.log('WhatsApp is ready!');
    const interval = setInterval(() => {
        api.get('/deadline').then(async res => {
            await res.data.data.forEach(async deadline => {
                const today = new Date();
                if (
                    (getDiffInDays(deadline.tanggal_kembali) === 3 && deadline.status_alert === "3_day_before") ||
                    (deadline.tanggal_kembali.toString() === today.toISOString().split("T")[0] && deadline.status_alert === "today") ||
                    (getDiffInDays(deadline.tanggal_kembali) === -3 && deadline.status_alert === "3_day_after")
                ) {
                    if (deadline.user) {
                        if (containsOnlyNumbers(deadline.user.telepon.toString())) {
                            const chatId = whatsappID(deadline.user.telepon.toString());

                            const isWAActived = await client.isRegisteredUser(chatId);

                            message = "*PERPUSTAKAAN SMAN Negeri 6 Mandau*\n\n" + generateMessage(deadline.tanggal_kembali) + "\n\nTerimakasih";
                            if (chatId && isWAActived) {
                                await client.sendMessage(chatId, message)
                                console.log("Berhasil Kirim Pesan ke " + chatId);
                            } else {
                                if (!isWAActived) console.log("Gagal mengirim Pesan : Nomor Whatsapp tujuan tidak aktif\n");
                            }
                        }
                        else {
                            console.log("Nomor tujuan tidak valid\n");
                        }
                        // update status data deadline
                        api.put(`/deadline/${deadline.id}`, { status: updateStatus(deadline.tanggal_kembali) })
                            .catch(error => {
                                console.log(error.response);
                                console.log("Gagal Update Status Deadline");
                            })
                    }
                }
            });
        }).catch(err => {
            console.log('gagal mengambil data deadline');
            if (err.response?.status === 401) {
                clearInterval(interval);
                console.log("Error 401 => Unauthorized\nPerbarui Access Token");
            } else {
                console.log("error ", err.response?.status ?? err);
            }
        })
    }, INTERVAL);
});

client.initialize();




