var authenticating = false;
var SAVEDDATA = null;
var LASTSERVERLIST = null;
var LAST_LOGS = null;
var CURRENT_STATE = {
    panel: null,
    interval: null,
    server: null,
};

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

function updateTerminal() {
    request("/servers/" + CURRENT_STATE.server + "/logs")
        .then(function (data) {
            if (
                data.logs.length != (LAST_LOGS != null ? LAST_LOGS.length : 0)
            ) {
                LAST_LOGS = data.logs;
                $('<div class="log-area noscroll"></div>')
                    .append(
                        data.logs.map(function (v, i, a) {
                            return $('<span class="line"></span>').text(v);
                        })
                    )
                    .replaceAll(".log-area");
                $(".log-area").scrollTop($(".log-area").height());
            }
        })
        .fail(function () {});
}

function updateServerList() {
    request("/servers").then(function (data) {
        if (JSON.stringify(data) != JSON.stringify(LASTSERVERLIST)) {
            LASTSERVERLIST = data;
            var dummyList = $('<div class="server-list noscroll"></div>');
            dummyList.append(
                Object.keys(data).map(function (v, i, a) {
                    if (!data[v].running && CURRENT_STATE.server == v) {
                        clearInterval(CURRENT_STATE.interval);
                        CURRENT_STATE.interval = null;
                        CURRENT_STATE.server = null;
                        CURRENT_STATE.panel = null;
                        $(".panel > .console").hide();
                    }
                    return $('<div class="server-item shadow-small"></div>')
                        .attr("data-name", v)
                        .addClass(data[v].running ? "active" : "inactive")
                        .append(
                            $(
                                '<span class="status material-icons noselect"></span>'
                            )
                                .addClass(
                                    data[v].running ? "active" : "inactive"
                                )
                                .text(
                                    data[v].running ? "check_circle" : "cancel"
                                )
                        )
                        .append($('<span class="server-name"></span>').text(v))
                        .append(
                            $('<span class="subtitle"></span>').text(
                                "@ " +
                                    data[v].address +
                                    " w/ " +
                                    data[v].mem +
                                    "GB RAM"
                            )
                        )
                        .append(
                            $('<button class="stop-start-server"></button>')
                                .append(
                                    data[v].running
                                        ? '<span class="material-icons">stop</span>'
                                        : '<span class="material-icons">play_arrow</span>'
                                )
                                .on("click", function (e) {
                                    if (
                                        $(e.delegateTarget)
                                            .parents(".server-item")
                                            .hasClass("active")
                                    ) {
                                        request(
                                            "/servers/" +
                                                $(e.delegateTarget)
                                                    .parents(".server-item")
                                                    .attr("data-name") +
                                                "/stop",
                                            { method: "POST" }
                                        ).then(updateServerList);
                                    } else {
                                        request(
                                            "/servers/" +
                                                $(e.delegateTarget)
                                                    .parents(".server-item")
                                                    .attr("data-name") +
                                                "/start",
                                            { method: "POST" }
                                        ).then(updateServerList);
                                    }
                                })
                        )
                        .append(
                            $('<button class="view-server"></button>')
                                .append(
                                    '<span class="material-icons">terminal</span>'
                                )
                                .toggleClass(
                                    "disabled",
                                    data[v].running ? false : true
                                )
                                .on("click", function (e) {
                                    if (
                                        $(e.delegateTarget).hasClass("disabled")
                                    ) {
                                        return;
                                    }
                                    clearInterval(CURRENT_STATE.interval);
                                    CURRENT_STATE.interval = null;
                                    if (
                                        CURRENT_STATE.panel == "console" &&
                                        CURRENT_STATE.server ==
                                            $(e.delegateTarget)
                                                .parents(".server-item")
                                                .attr("data-name")
                                    ) {
                                        CURRENT_STATE.panel = null;
                                        CURRENT_STATE.server = null;
                                        $(".panel > .console").hide();
                                        return;
                                    } else {
                                        CURRENT_STATE.panel = "console";
                                        CURRENT_STATE.server = $(
                                            e.delegateTarget
                                        )
                                            .parents(".server-item")
                                            .attr("data-name");
                                        CURRENT_STATE.interval = setInterval(
                                            updateTerminal,
                                            1000
                                        );
                                        updateTerminal();
                                        $(".panel > .console").show();
                                    }
                                })
                        )
                        .append(
                            $('<button class="edit-server"></button>').append(
                                '<span class="material-icons">settings</span>'
                            )
                        );
                })
            );
            dummyList.replaceAll(".server-list");
        }
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

    $(".command-input").on("change", function () {
        if ($(".command-input").val().length == 0) {
            return;
        }
        if (!CURRENT_STATE.server) {
            return;
        }
        request("/servers/" + CURRENT_STATE.server + "/command", {
            method: "POST",
            data: {
                command: $(".command-input").val(),
            },
        });
        $(".command-input").val("");
    });
    $(".send-cmd-btn").on("click", function () {
        if ($(".command-input").val().length == 0) {
            return;
        }
        if (!CURRENT_STATE.server) {
            return;
        }
        request("/servers/" + CURRENT_STATE.server + "/command", {
            method: "POST",
            data: {
                command: $(".command-input").val(),
            },
        });
        $(".command-input").val("");
    });

    setInterval(updateServerList, 2500);
    updateServerList();
});
