export function showError(where, err) {
    console.error(`Error in ${where}:`, err);

    const errBanner = document.querySelector("#err-banner");

    const fmtErr = (e) => e.toString() + (e.stack ? " - at:\n" + e.stack : "");

    errBanner.querySelector(".where").innerHTML = where;
    errBanner.querySelector(".message").innerHTML = err instanceof Error ? fmtErr(err) : JSON.stringify(err, null, 2);

    errBanner.classList.add("has-err");
    setTimeout(() => errBanner.classList.remove("has-err"), 10_000);
}

/**
 * @param {string} message
 * @param {() => void | Promise<void>} onConfirm
 * @param {() => void | Promise<void>} onCancel
 */
export function showConfirmDialog(message, onConfirm, onCancel = () => {}) {
    /** @type {HTMLDivElement} */
    const confirmDialog = document.querySelector("#confirm-dialog");

    const msgElement = confirmDialog.querySelector(".message");
    // msgElement.innerHTML = "";
    // msgElement.appendChild(document.createTextNode(message));

    msgElement.innerHTML = message;

    /** @param {PointerEvent} ev */
    const btnClickCallback = (ev) => {
        confirmDialog.classList.remove("show");
        confirmDialog
            .querySelectorAll(".actions button")
            .forEach((b) => b.removeEventListener("click", btnClickCallback));

        if (ev.target.classList.contains("cancel")) return onCancel();
        if (ev.target.classList.contains("confirm")) return onConfirm();
    };

    confirmDialog.querySelectorAll(".actions button").forEach((b) => b.addEventListener("click", btnClickCallback));
    confirmDialog.classList.add("show");
}

/** @returns {string | null} */
export function currentChat() {
    const isInChatScreen = location.pathname.match(/\/chat\/(?<chat_id>[^\/]+)/);
    const currOpenChatId = isInChatScreen?.groups?.chat_id;
    return currOpenChatId ?? null;
}
