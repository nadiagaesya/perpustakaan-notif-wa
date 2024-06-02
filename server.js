const axios = require('axios').default;
const { formatTanggalIndonesia, getDiffInDays } = require('./DateUtils')
const { makeWASocket, DisconnectReason, useMultiFileAuthState, isJidBroadcast } = require("@whiskeysockets/baileys");
const pino = require('pino');
const { Boom } = require("@hapi/boom")
const fs = require("fs")

const HOST = "http://127.0.0.1:8000/api";
const ACCESS_TOKEN = "";
const api = axios.create({
    baseURL: HOST,
    headers: {
        Authorization: "Bearer " + ACCESS_TOKEN
    }
})
const INTERVAL = 5000;

let sock = null

function generateMessage(deadline) {
    const today = new Date();
    const diffInDays = getDiffInDays(deadline)
    if (deadline.toString() === today.toISOString().split("T")[0]) {
        return `Segera kembalikan buku, batas waktu peminjaman buku 3 hari lagi pada tanggal ${formatTanggalIndonesia(deadline)}`;
    } else if (diffInDays === 3) {
        return `Selamat peminjaman buku telah disetujui, waktu pengembalian pada tanggal ${formatTanggalIndonesia(deadline)}`;
    } else if (diffInDays === -3) {
        return `Segera kembalikan buku, waktu pengembalian telah melewati batas waktu`;
    } else {
        return "";
    }
}

function containsOnlyNumbers(str) {
    return /^\d+$/.test(str);
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
function whatsappID(phone) {
    if (phone.charAt(0) === "0" || phone.charAt(0) === "+") {
        return "62" + phone.substring(1) + "@s.whatsapp.net"
    }
    else if (phone.charAt(0) === "6") {
        return phone + "@s.whatsapp.net"
    }
    else if (phone.charAt(0) === "8") {
        return "62" + phone + "@s.whatsapp.net"
    }
    else {
        return false
    }
}
async function run(interval) {
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

                        message = "*PERPUSTAKAAN SMAN Negeri 6 Mandau*\n\n" + generateMessage(deadline.tanggal_kembali) + "\n\nTerimakasih";
                        if (chatId) {
                            try {
                                await sock.sendMessage(chatId, { text: message })
                                console.log("Berhasil Kirim Pesan ke " + chatId);
                            } catch (e) {
                                console.log(e);
                            }
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
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        shouldIgnoreJid: jid => isJidBroadcast(jid),
        logger: pino({ level: 'silent' })
    })

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect.error).output?.statusCode;

            switch (reason) {
                case DisconnectReason.loggedOut:
                    // Delete Folder Auth Session
                    fs.rmSync('./auth_info_baileys', { recursive: true, force: true })
                    console.log(`Device Logged Out, Please Scan Again.`);
                    break;
                case DisconnectReason.connectionClosed:
                    console.log("Connection closed, reconnecting....");
                    break;
                case DisconnectReason.connectionLost:
                    console.log("Connection Lost, reconnecting....");
                    break;
                default:
                    console.log("Connecting...");
            }
            connectToWhatsApp()
        } else if (connection === 'open') {
            console.log(`Whatsapp ${sock.user.id} Ready!`);
            const interval = setInterval(() => {
                run(interval)
            }, INTERVAL)
        }
    })
    sock.ev.on('creds.update', saveCreds);
}

// run in main file
connectToWhatsApp();