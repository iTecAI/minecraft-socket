var authenticating = false;
var SAVEDDATA = null;

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

function load_newserver() {
    SAVEDDATA = null;
    request("/versions").then(function (data) {
        var dummyDatalist = $('<datalist id="versions"> </datalist>');
        for (version of Object.keys(data.paper).reverse()) {
            dummyDatalist.append(
                $(
                    '<option value="' +
                        data.paper[version] +
                        '">Paper ' +
                        version +
                        "</option>"
                )
            );
        }
        for (version of Object.keys(data.vanilla)) {
            dummyDatalist.append(
                $(
                    '<option value="' +
                        data.vanilla[version] +
                        '">Vanilla ' +
                        version +
                        "</option>"
                )
            );
        }
        dummyDatalist.replaceAll("#versions");

        $(".new-server").show();
        $(".new-server input").val("");
        console.log(data);
    });
}

$(document).ready(function () {
    authenticate();

    $(".new-server-button").on("click", load_newserver);
    $(".jar-upload input").on("change", function () {
        const file = document.querySelector(".jar-upload input").files[0];
        const reader = new FileReader();
        reader.addEventListener(
            "load",
            function () {
                if (
                    reader.result
                        .toString()
                        .includes("data:application/x-java-archive;")
                ) {
                    SAVEDDATA = reader.result;
                    $(".jar-upload").css({ "border-color": "var(--s)" });
                    setTimeout(
                        () =>
                            $(".jar-upload").css({
                                "border-color": "var(--pl)",
                            }),
                        2500
                    );
                    $(".jar-upload .upload-title").text(file.name);
                } else {
                    $(".jar-upload").css({ "border-color": "#db3125" });
                    setTimeout(
                        () =>
                            $(".jar-upload").css({
                                "border-color": "var(--pl)",
                            }),
                        2500
                    );
                }
            },
            false
        );

        if (file) {
            reader.readAsDataURL(file);
        }
    });
    $(".button-group .cancel").on("click", () => $(".new-server").hide());
    $(".button-group .submit").on("click", function () {
        var fields = {};
        if (!SAVEDDATA && $("input.version-input").val() == "") {
            alert(
                "Please provide either a server.jar or select a version to install."
            );
            return;
        } else if (SAVEDDATA) {
            fields.jar = SAVEDDATA;
        } else {
            fields.jar = $("input.version-input").val();
        }
        if ($(".server-settings .input.server-name input").val() != "") {
            fields.name = $(".server-settings .input.server-name input").val();
        }
        if ($(".server-settings .input.server-motd input").val() != "") {
            fields.motd = $(".server-settings .input.server-motd input").val();
        }
        if ($(".server-settings .input.server-ip input").val() != "") {
            fields.server_ip = $(
                ".server-settings .input.server-ip input"
            ).val();
        }
        if ($(".server-settings .input.server-port input").val() != "") {
            if (
                !isNaN(
                    Number($(".server-settings .input.server-port input").val())
                )
            ) {
                fields.server_port = Number(
                    $(".server-settings .input.server-port input").val()
                );
            } else {
                alert("Ports must be numerical (or blank for default 25565)");
                return;
            }
        }
        if ($(".server-settings .input.server-max-players input").val() != "") {
            if (
                !isNaN(
                    Number(
                        $(
                            ".server-settings .input.server-max-players input"
                        ).val()
                    )
                )
            ) {
                fields.max_players = Number(
                    $(".server-settings .input.server-max-players input").val()
                );
            } else {
                alert(
                    "Max players must be numerical (or blank for default 20)"
                );
                return;
            }
        }
        if ($(".server-settings .input.server-seed input").val() != "") {
            fields.world_seed = $(
                ".server-settings .input.server-seed input"
            ).val();
        }
        if ($(".server-settings .input.server-gamemode select").val() != "") {
            fields.gamemode = $(
                ".server-settings .input.server-gamemode select"
            ).val();
        }
        if ($(".server-settings .input.server-difficulty select").val() != "") {
            fields.difficulty = $(
                ".server-settings .input.server-difficulty select"
            ).val();
        }
        if ($(".server-settings .input.server-whitelist select").val() != "") {
            fields.whitelist =
                $(".server-settings .input.server-whitelist select").val() ==
                "true"
                    ? true
                    : false;
        }
        if ($(".server-settings .input.server-cmdblocks select").val() != "") {
            fields.command_blocks =
                $(".server-settings .input.server-cmdblocks select").val() ==
                "true"
                    ? true
                    : false;
        }
        if ($(".server-settings .input.server-args input").val() != "") {
            fields.other_args = $(
                ".server-settings .input.server-args input"
            ).val();
        }
        if ($(".server-settings .input.server-memory input").val() != "") {
            if (
                !isNaN(
                    Number(
                        $(".server-settings .input.server-memory input").val()
                    )
                )
            ) {
                fields.max_memory = Number(
                    $(".server-settings .input.server-memory input").val()
                );
            } else {
                alert(
                    "Server memory must be numerical (or blank for default 2)"
                );
                return;
            }
        }
        request("/servers/new", {
            method: "POST",
            data: fields,
        }).then(function (data) {
            console.log(data);
            $(".new-server").hide();
        });
    });
});
