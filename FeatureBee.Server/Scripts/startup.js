﻿$(function () {
    // board hub => board specific functions. 
    var boardHub = $.connection.boardHub;
    // edit panel hub => edit dialog specific functions.
    var editPanelHub = $.connection.editPanelHub;
    var form;
    
    boardHub.client.featureCreated = function (item) {
        $.Comm('page', 'itemChanged').publish(item);
    };

    boardHub.client.featureReleasedForEveryone = function (item) {
        $.Comm('page', 'itemMoved').publish(item);
    };
    
    boardHub.client.featureReleasedWithConditions = function (item) {
        $.Comm('page', 'itemMoved').publish(item);
    };

    boardHub.client.featureRollbacked = function (item) {
        $.Comm('page', 'itemMoved').publish(item);
    };

    editPanelHub.client.linkedToTicket = function (item) {
        $.Comm('page', 'itemChanged').publish(item);
    };

    editPanelHub.client.descriptionUpdated = function (item) {
        $.Comm('page', 'itemChanged').publish(item);
    };

    editPanelHub.client.conditionsChanged = function (item) {
        $.Comm('page', 'conditionsChanged:' + item).publish(item);
    };


    var boot = {
        loadPrerequisite: function () {
            form = new forms();
            return this;
        },

        loadTemplates: function () {
            handleBar(new conditionTemplates(form));
            return this;
        },
   
        loadMenu: function () {
            $('[data-open="newFeature"]').click(form.openNew);
            return this;
        },
        
        loadBoard: function () {
            board();
            return this;
        }
    };

    var dataFilter = function () {

        $('[data-filter-team]').click(function() {
            if (!$(this).hasClass('disabled')) {
                $(this).addClass("disabled");
            } else {
                $(this).removeClass("disabled");
            }
            changed();
            return false;
        });

        var byTeam = function (data) {
            var enabledTeams = $('[data-filter-team]').not('.disabled').map(function () { return $(this).attr('data-filter-team').toUpperCase(); }).get();
            return jQuery.grep(data, function (value) {
                return $.inArray(value.team.toUpperCase(), enabledTeams) >= 0;
            });
        };

        var changed = function () {
            $.Comm('page', 'itemChanged').publish();
        };

        this.apply = function (data) {
            var filters = [byTeam];
            $.each(filters, function (index, value) {
                data = value(data);
            });
            return data;
        };
    };

    var filter = new dataFilter();

    var dataProvider = function() {
        var data = null;
        jQuery.ajaxSetup({ async: false });
        $.get('/api/features').done(function (d) {
            data = d;
        });
        jQuery.ajaxSetup({ async: true });

        return filter.apply(data);
    };

    var board = function() {
        $('#board').boardify({
            states: "[data-state]",
            template: '[data-item]',
            source: dataProvider,
            subscribeToItemChanged: function(obj) {
                boardHub.server.moveItem(obj.data.name, obj.data.index);
            },
            subscribeToItemSelected: function(obj) {
                form.openEdit(obj.data);
            }
        });

        $('#board').boardify('subscribeFor', 'page', 'itemChanged', $.boardifySubscribers.refresh);
        $('#board').boardify('subscribeFor', 'page', 'itemMoved', $.boardifySubscribers.refresh);
    };

    var conditionTemplates = function () {
        var templates = [];
        $('[data-template]').each(function (index, value) {
            templates.push({
                type: $(value).attr('data-template'),
                template: $(value)
            });
        });

        var c = $('[data-container="condition"]').conditionify({
            conditions: templates,
            add: function (data) {
                editPanelHub.server.addConditionValue(data.name, data.type, data.values);
            },
            delete: function (data) {
                editPanelHub.server.removeConditionValue(data.name, data.type, data.values);
            },
            new: function (data) {
                editPanelHub.server.createCondition(data.name, data.type);
            }
        });

        this.render = function (name, type, element, data) {
            c.conditionify('render', name, type, element, data);
        };
        
        this.renderAddNewCondition = function (name) {
            c.conditionify('renderAddNewCondition', name);
        };
    };

    var handleBar = function(templates) {
        var self = this;
        
        Handlebars.registerHelper('setIndex', function (value) {
            this.outerindex = Number(value);
        });

        window.Handlebars.registerHelper('select', function(value, options) {
            var $el = $('<select />').html(options.fn(this));
            $el.find('[value=' + value + ']').attr({ 'selected': 'selected' });
            return $el.html();
        });
        window.Handlebars.registerHelper('condition', function(name, type, conditions, options) {
            var $el = $(options.fn({ type: type, values: conditions }).trim());
            templates.render(name, type, conditions);
            return $el.html();
        });
        window.Handlebars.registerHelper('emptyCondition', function (name) {
            templates.renderAddNewCondition(name);
            return "";
        });
        window.Handlebars.registerHelper('editExisting', function (name) {
            return name == "edit";
        });
    };

    var forms = function () {
        var self = this;

        var createForm = function (usingItem, withWidth, callback) {
            return usingItem.clone().appendTo(usingItem.parent()).formify({
                save: function (data) {
                    callback(data);
                },
                width: withWidth,
                source: function(feature) {
                    var data = null;
                    jQuery.ajaxSetup({ async: false });
                    $.get('/api/features/?id=' + feature).done(function (d) {
                        data = d;
                    });
                    jQuery.ajaxSetup({ async: true });
                    return data;
                }
            });
        };

        var createEditForm = function (usingItem) {
            return createForm(usingItem, $(window).width() - 180,
            function(data) {
                editPanelHub.server.editItem(
                {
                    name: data.name,
                    description: data.description,
                    link: data.link
                });
                // TODO: editPanelHub.server.changeConditions(data.name, data.conditions);
            });
        };

        var createNewForm = function (usingItem) {
            return createForm(usingItem, $(window).width() / 2, function (data) {
                boardHub.server.addNewItem(
                    {
                        name: data.name,
                        team: data.team,
                        description: data.description,
                        link: data.link,
                        conditions: data.conditions
                    });
            });
        };

        var formEdit = createEditForm($('[data-edit-item="edit"]'));
        var formNew = createNewForm($('[data-edit-item="new"]'));

        this.openEdit = function (data) {
            formEdit.formify('open', data);
        };

        this.openNew = function () {
            formNew.formify('open');
        };
    };

    $.connection.hub.start().done(function () {
        boot.loadPrerequisite().loadTemplates().loadMenu().loadBoard();
    });
});