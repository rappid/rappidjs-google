define(['require', 'js/core/Component', 'js/core/Base', 'js/core/History', 'flow', 'js/core/Bindable'], function (require, Component, Base, History, flow, Bindable) {

    var PageTracker = Component.inherit('google.analytics.PageTracker', {

        defaults: {
            account: null,
            domain: null,
            debug: false,
            enabled: true,
            siteSpeedSampleRate: null
        },

        initialize: function () {

            var self = this,
                window = this.$stage.$window;

            this.$trackQueue = [];
            this.$pageTracker = null;

            var history = this.$stage.$history,
                account = this.$.account;

            if (!history) {
                this.log("History not found.", Base.LOGLEVEL.ERROR);
                return;
            }

            if (!account) {
                this.log("Account not defined", Base.LOGLEVEL.ERROR);
                return;
            }

            if (!this.$.domain) {
                var domain = window.location.host || window.location.hostname;
                this.$.domain = domain;
                this.log("Domain not defined. Using: " + domain);
            }

            if (this.runsInBrowser()) {
                // only track if we run inside a browser

                // bind to history events
                history.bind(History.EVENTS.NAVIGATION_COMPLETE, function (e) {
                    if (e.$.triggerRoute && e.$.createHistoryEntry) {
                        // track this fragment
                        this.trackPageView(e.$.fragment);
                    }
                }, this);


                var url = (this.$stage.$document.location.protocol === 'https:' ? 'https://ssl' : 'http://www') +
                    '.google-analytics.com/ga.js';

                require([url], function () {
                    var gat = window['_gat'];

                    if (gat && gat._createTracker) {
                        var pageTracker = gat._createTracker(self.$.account);
                        if (pageTracker) {
                            pageTracker._setDomainName(self.$.domain);

                            if (self.$.siteSpeedSampleRate) {
                                pageTracker._setSiteSpeedSampleRate && pageTracker._setSiteSpeedSampleRate(self.$.siteSpeedSampleRate);
                            }

                            self.$pageTracker = pageTracker;
                            self._trackQueue();
                        }
                    }

                });
            }

            this.callBase();
        },

        _queueOrExecute: function (executeFunction) {

            // do not track during node rendering or when disabled
            if (!this.runsInBrowser() || !this.$.enabled) {
                return;
            }

            if (this.$pageTracker) {
                // tracker available
                try {
                    executeFunction.apply(this.$pageTracker);
                } catch (e) {
                    this.log(e, 'error');
                }
            } else {
                // queue it
                this.$trackQueue.push(executeFunction);
            }

        },

        trackPageView: function (url) {
            this._queueOrExecute(function () {
                this._trackPageview(url);
            });

            this._debug('trackPageView: ' + url);
        },

        _debug: function (message) {
            if (this.$.debug) {
                this.log(message);
            }
        },

        /***
         *
         * @param category - The name you supply for the group of objects you want to track.
         * @param action - A string that is uniquely paired with each category, and commonly used to define the type of user interaction for the web object.
         * @param [label] - An optional string to provide additional dimensions to the event data.
         * @param [value]
         * @param {Boolean} [nonInteraction]
         */
        trackEvent: function (category, action, label, value, nonInteraction) {

            if (label instanceof Array) {
                label = label.join(';')
            }

            this._queueOrExecute(function () {
                this._trackEvent(category, action, label, value, nonInteraction);
            });

            this._debug('trackEvent: ' + [category, action, label, value, nonInteraction].join(', '));
        },

        /***
         *
         * @param {Number} index - The slot for the custom variable. This is a number whose value can range from 1 - 5, inclusive. A custom variable should be placed in one slot only and not be re-used across different slots.
         * @param {String} name - The name for the custom variable. This is a string that identifies the custom variable and appears in the top-level Custom Variables report of the Analytics reports.
         * @param {String} value - The value for the custom variable. This is a string that is paired with a name. You can pair a number of values with a custom variable name. The value appears in the table list of the UI for a selected variable name. Typically, you will have two or more values for a given name. For example, you might define a custom variable name gender and supply male and female as two possible values.
         * @param [scope] - The scope for the custom variable. Optional. As described above, the scope defines the level of user engagement with your site. It is a number whose possible values are 1 (visitor-level), 2 (session-level), or 3 (page-level). When left undefined, the custom variable scope defaults to page-level interaction.
         */
        setCustomVar: function (index, name, value, scope) {
            this._queueOrExecute(function () {
                this._setCustomVar(index, name, value, scope);
            })
        },

        /***
         *
         * @param {String} category - A string for categorizing all user timing variables into logical groups for easier reporting purposes. For example you might use value of jQuery if you were tracking the time it took to load that particular JavaScript library.
         * @param {String} variable - A string to indicate the name of the action of the resource being tracked. For example you might use the value of JavaScript Load if you wanted to track the time it took to load the jQuery JavaScript library. Note that same variables can be used across multiple categories to track timings for an event common to these categories such as Javascript Load and Page Ready Time, etc.
         * @param {Number} time - The number of milliseconds in elapsed time to report to Google Analytics. If the jQuery library took 20 milliseconds to load, then you would send the value of 20.
         * @param {String} [label] - A string that can be used to add flexibility in visualizing user timings in the reports. Labels can also be used to focus on different sub experiments for the same category and variable combination. For example if we loaded jQuery from the Google Content Delivery Network, we would use the value of Google CDN.
         * @param {Number} [sample] - A number to manually override the percent of visitors whose timing hits get sent to Google Analytics. The default is set at the same number as general site speed data collection and is based as a percentage of visitors. So if you wanted to track _trackTiming hits for 100% of visitors, you would use the value 100. Note that each hit counts against the general 500 hits per session limit.
         */
        trackTiming: function (category, variable, time, label, sample) {
            this._queueOrExecute(function () {
                this._trackTiming(category, variable, time, label, sample);
            })
        },

        /***
         *
         * @param orderId - Internal unique order id number for this transaction.
         * @param [affiliation] - Partner or store affiliation
         * @param total - Total dollar amount of the transaction.
         * @param [tax] - Tax amount of the transaction
         * @param [shipping] - Shipping charge for the transaction.
         * @param [city] - City to associate with transaction.
         * @param [state] - State to associate with transaction.
         * @param [country] - Country to associate with transaction.
         * @return {google.analytics.PageTracker.Transaction}
         */
        createTransaction: function (orderId, affiliation, total, tax, shipping, city, state, country) {
            return new PageTracker.Transaction({
                orderId: orderId,
                affiliation: affiliation,
                total: total,
                tax: tax,
                shipping: shipping,
                city: city,
                state: state,
                country: country
            });
        },

        /***
         *
         * @param {google.analytics.PageTracker.Transaction} transaction
         */
        trackTransaction: function (transaction) {

            if (!(transaction instanceof PageTracker.Transaction)) {
                this.log('Transaction not of type PageTracker.Transaction', 'warn');
                return;
            }

            this._queueOrExecute(function () {
                transaction.track(this);
            });
        },

        _trackQueue: function () {
            var self = this;
            // track all events from queue
            flow()
                .seqEach(this.$trackQueue, function (executeFunction) {
                    executeFunction.apply(self.$pageTracker);
                })
                .exec(function () {
                    self.$trackQueue = [];
                });
        }

    });

    PageTracker.Transaction = Bindable.inherit('google.analytics.PageTracker.Transaction', {

        defaults: {
            orderId: null,
            affiliation: null,
            total: null,
            tax: null,
            shipping: null,
            city: null,
            state: null,
            country: null,

            items: Array
        },

        /***
         *
         * @param {String} sku -  Item's SKU code.
         * @param {String} name - Product name. Required to see data in the product detail report.
         * @param {String} price - Product price.
         * @param {String} quantity - Purchase quantity.
         * @param {String} [category] - Product category.
         *
         * @return {google.analytics.PageTracker.Transaction.Item}
         */
        addItem: function (sku, name, price, quantity, category) {
            var ret = new PageTracker.Transaction.Item({
                sku: sku,
                name: name,
                price: price,
                quantity: quantity,
                category: category
            });

            this.$.items.push(ret);
            return ret;
        },

        track: function (pageTracker) {
            pageTracker._addTrans(this.$.orderId, this.$.affiliation, this.$.total, this.$.tax, this.$.shipping, this.$.city, this.$.state, this.$.country);
            for (var i = 0; i < this.$.items.length; i++) {
                var item = this.$.items[i];
                pageTracker._addItem(this.$.orderId, item.$.sku, item.$.name, item.$.category, item.$.price, item.$.quantity);
            }
            pageTracker._trackTrans();
        }

    });

    PageTracker.Transaction.Item = Bindable.inherit('google.analytics.PageTracker.Transaction.Item', {});

    PageTracker.Scope = {
        Visitor: 1,
        Session: 2,
        Page: 3
    };

    return PageTracker;
});