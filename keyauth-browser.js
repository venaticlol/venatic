// Browser-compatible KeyAuth wrapper
class KeyAuth {
    constructor(options) {
        this.name = options.name;
        this.ownerid = options.ownerid;
        this.version = options.version;
        this.url = "https://keyauth.win/api/1.3/";
        this.initialized = false;
    }

    async init() {
        if (this.initialized) {
            return;
        }

        const postData = {
            type: "init",
            name: this.name,
            ownerid: this.ownerid,
            version: this.version
        };

        try {
            const response = await this.__do_request(postData);
            
            if (response === "KeyAuth_Invalid") {
                throw new Error("Invalid application");
            }

            this.sessionid = response["sessionid"];
            this.initialized = true;
            return response;
        } catch (error) {
            throw new Error("Failed to initialize KeyAuth");
        }
    }

    async license(key) {
        // Ensure initialized
        if (!this.initialized) {
            await this.init();
        }

        const postData = {
            type: "license",
            name: this.name,
            ownerid: this.ownerid,
            sessionid: this.sessionid,
            key: key,
            hwid: this.get_hwid()
        };

        const response = await this.__do_request(postData);
        
        if (response["success"] === true) {
            this.__load_user_data(response["info"]);
            return {
                success: true,
                message: response["message"],
                data: this.user_data
            };
        } else {
            return {
                success: false,
                message: response["message"]
            };
        }
    }

    async resetHWID(key) {
        // Ensure initialized
        if (!this.initialized) {
            await this.init();
        }

        // NOTE: HWID Reset may not be available in all KeyAuth plans
        // The endpoint might be: "resethwid", "reset_hwid", or might not exist at all
        // Contact KeyAuth support to enable this feature on your account
        
        const postData = {
            type: "resethwid", // Try this endpoint first
            name: this.name,
            ownerid: this.ownerid,
            sessionid: this.sessionid,
            key: key
        };

        try {
            const response = await this.__do_request(postData);
            
            if (response["success"] === true) {
                return {
                    success: true,
                    message: response["message"]
                };
            } else {
                // Check if the error is about endpoint not found
                const errorMsg = response["message"] || "";
                if (errorMsg.toLowerCase().includes("not found") || 
                    errorMsg.toLowerCase().includes("parameter")) {
                    return {
                        success: false,
                        message: "HWID Reset is not available on your KeyAuth account.\n\nTo enable:\n1. Log into your KeyAuth dashboard\n2. Go to app settings\n3. Enable 'HWID Reset' feature\n4. Or upgrade to a plan that includes this feature\n\nFor now, users must contact support to reset their HWID."
                    };
                }
                
                return {
                    success: false,
                    message: response["message"]
                };
            }
        } catch (error) {
            console.error('HWID reset error:', error);
            return {
                success: false,
                message: "HWID Reset feature is not enabled on your KeyAuth account. Please enable it in your dashboard or contact KeyAuth support."
            };
        }
    }

    get_hwid() {
        // Generate a simple hardware ID for browser
        return this._getCookie("hwid") || this._setCookie("hwid", this._generateHWID());
    }

    _generateHWID() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px "Arial"';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('HWID-GEN', 2, 2);
        
        const fingerprint = canvas.toDataURL();
        return btoa(navigator.userAgent + fingerprint).substring(0, 32);
    }

    _getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    _setCookie(name, value) {
        document.cookie = `${name}=${value}; path=/; max-age=31536000`;
        return value;
    }

    async __do_request(data) {
        try {
            const response = await fetch(this.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams(data).toString()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const responseData = await response.json();
            return responseData;
        } catch (error) {
            console.error("KeyAuth request error:", error);
            throw error;
        }
    }

    __load_user_data(data) {
        this.user_data = {
            username: data["username"],
            ip: data["ip"],
            hwid: data["hwid"] || "N/A",
            expires: data["subscriptions"][0]["expiry"],
            createdate: data["createdate"],
            lastlogin: data["lastlogin"],
            subscription: data["subscriptions"][0]["subscription"],
            subscriptions: data["subscriptions"]
        };
    }
}

