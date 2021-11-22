var authenticating = false;

function request(url, options) {
    if (!options) {
        var options = {};
    }
    return $.ajax({
        url: url + (options.params ? "?" + $.param(options.params) : ""),
        method: options.method ? options.method : "GET",
        data: JSON.stringify(options.data ? options.data : {}),
        contentType: options.data ? "json" : undefined,
        processData: false,
        statusCode: {
            403: authenticate,
        },
        headers: sessionStorage["connection"]
            ? { "x-authkey": sessionStorage["connection"] }
            : {},
    });
}

function authenticate() {
    if (authenticating) {
        return;
    }
    if (sessionStorage["connection"]) {
        request("/versions")
            .then(console.log)
            .fail(function () {
                sessionStorage.removeItem("connection");
                authenticate();
            });
        return;
    }
    authenticating = true;
    var password = sha256(prompt("Enter password to access."));
    request("/auth", { method: "POST", data: { passhash: password } })
        .then(function (data) {
            sessionStorage.setItem("connection", data.connection_id);
            request("/versions").then(console.log);
        })
        .done(() => (authenticating = false));
}

$(document).ready(function () {
    authenticate();
});
