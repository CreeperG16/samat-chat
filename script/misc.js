export function showError(where, err) {
    console.error(`Error in ${where}:`, err);

    const errBanner = document.querySelector("#err-banner");

    const fmtErr = (e) => e.toString() + (e.stack ? " - at:\n" + e.stack : "");

    errBanner.querySelector(".where").innerHTML = where;
    errBanner.querySelector(".message").innerHTML =
        err instanceof Error ? fmtErr(err) : JSON.stringify(err);

    errBanner.classList.add("has-err");
    setTimeout(() => errBanner.classList.remove("has-err"), 10_000);
}
