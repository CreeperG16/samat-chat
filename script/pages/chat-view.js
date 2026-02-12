export function renderChatView({ chat_id }) {
    // TODO
    const mainPanel = document.querySelector(".main");
    const messageContainer = mainPanel.querySelector(".container.message-container");

    messageContainer.classList.remove("hidden");
    mainPanel.classList.add("drawer-open");

    // console.log("CHAT VIEW!!! chat id is", chat_id);
}
