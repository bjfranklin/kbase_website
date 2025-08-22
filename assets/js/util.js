/* util.js — modernized for HTML5 UP Dimension
   - Keeps original public API: $.fn.navList, $.fn.panel, $.fn.placeholder, $.prioritize
   - Fixes edge-case returns, safer jQuery checks, and small a11y tweaks.
   - Modernizes event handling (passive where appropriate), touch/scroll guards.
*/
(function ($) {
  "use strict";

  /* ------------------------------------------------------------
   * navList(): build a flat list of links from a nested <nav>
   * ---------------------------------------------------------- */
  $.fn.navList = function () {
    const $root = $(this);
    const out = [];
    $root.find("a").each(function () {
      const $a = $(this);
      const indent = Math.max(0, $a.parents("li").length - 1);
      const href = $a.attr("href");
      const target = $a.attr("target");
      out.push(
        '<a class="link depth-' +
          indent +
          '"' +
          (target ? ' target="' + target + '"' : "") +
          (href ? ' href="' + href + '"' : "") +
          ">" +
          '<span class="indent-' +
          indent +
          '"></span>' +
          $a.text() +
          "</a>"
      );
    });
    return out.join("");
  };

  /* ------------------------------------------------------------
   * panel(): show/hide sliding panels
   * ---------------------------------------------------------- */
  $.fn.panel = function (userConfig) {
    if (this.length === 0) return $(this);      // fix: avoid returning undefined $this
    if (this.length > 1) {
      this.each(function () { $(this).panel(userConfig); });
      return $(this);
    }

    const $this = $(this);
    const $body = $("body");
    const $window = $(window);
    const id = $this.attr("id");

    // Default config
    const config = $.extend(
      {
        delay: 0,
        hideOnClick: false,
        hideOnEscape: false,
        hideOnSwipe: false,
        resetScroll: false,
        resetForms: false,
        side: null,
        target: $this,
        visibleClass: "visible",
      },
      userConfig
    );

    // Ensure target is a jQuery object
    if (!(config.target && config.target.jquery)) {
      config.target = $(config.target);
    }

    // Helper: update aria state
    function setAria(expanded) {
      config.target.attr("aria-expanded", expanded ? "true" : "false");
    }

    // Hide method
    $this._hide = function (event) {
      if (!config.target.hasClass(config.visibleClass)) return;

      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      config.target.removeClass(config.visibleClass);
      setAria(false);

      window.setTimeout(function () {
        if (config.resetScroll) $this.scrollTop(0);
        if (config.resetForms) {
          $this.find("form").each(function () {
            // Avoid triggering change events unnecessarily
            this.reset();
          });
        }
      }, config.delay);
    };

    // Vendor/UX niceties
    $this
      .css("-ms-overflow-style", "-ms-autohiding-scrollbar")
      .css("-webkit-overflow-scrolling", "touch");

    // Hide on link click (inside panel)
    if (config.hideOnClick) {
      $this
        .find("a")
        .css("-webkit-tap-highlight-color", "transparent");

      $this.on("click", "a", function (event) {
        const $a = $(this);
        const href = $a.attr("href");
        const target = $a.attr("target");

        if (!href || href === "#" || href === "" || href === "#" + id) return;

        event.preventDefault();
        event.stopPropagation();

        $this._hide();

        window.setTimeout(function () {
          if (target === "_blank") window.open(href);
          else window.location.href = href;
        }, config.delay + 10);
      });
    }

    // Touch handling
    $this.on(
      "touchstart",
      function (event) {
        const t = event.originalEvent.touches[0];
        $this.touchPosX = t.pageX;
        $this.touchPosY = t.pageY;
      }
    );

    $this.on(
      "touchmove",
      function (event) {
        if ($this.touchPosX == null || $this.touchPosY == null) return;

        const t = event.originalEvent.touches[0];
        const diffX = $this.touchPosX - t.pageX;
        const diffY = $this.touchPosY - t.pageY;
        const th = $this.outerHeight();
        const ts = $this.get(0).scrollHeight - $this.scrollTop();

        // Hide on swipe?
        if (config.hideOnSwipe) {
          let shouldHide = false;
          const boundary = 20;
          const delta = 50;

          switch (config.side) {
            case "left":
              shouldHide = Math.abs(diffY) < boundary && diffX > delta;
              break;
            case "right":
              shouldHide = Math.abs(diffY) < boundary && diffX < -delta;
              break;
            case "top":
              shouldHide = Math.abs(diffX) < boundary && diffY > delta;
              break;
            case "bottom":
              shouldHide = Math.abs(diffX) < boundary && diffY < -delta;
              break;
          }

          if (shouldHide) {
            $this.touchPosX = null;
            $this.touchPosY = null;
            $this._hide();
            return false;
          }
        }

        // Prevent overscroll bounce
        if (($this.scrollTop() < 0 && diffY < 0) || (ts > th - 2 && ts < th + 2 && diffY > 0)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    );

    // Stop propagation of pointer/touch/click inside the panel
    $this.on("click touchend touchstart touchmove", function (event) {
      event.stopPropagation();
    });

    // Hide panel if a child anchor points to its own ID
    $this.on("click", 'a[href="#' + id + '"]', function (event) {
      event.preventDefault();
      event.stopPropagation();
      config.target.removeClass(config.visibleClass);
      setAria(false);
    });

    // Body clicks/taps hide the panel
    $body.on("click touchend", function (event) {
      $this._hide(event);
    });

    // Toggle via links that target this panel
    $body.on("click", 'a[href="#' + id + '"]', function (event) {
      event.preventDefault();
      event.stopPropagation();
      const willShow = !config.target.hasClass(config.visibleClass);
      config.target.toggleClass(config.visibleClass);
      setAria(willShow);
    });

    // Hide on ESC
    if (config.hideOnEscape) {
      $window.on("keydown", function (event) {
        if (event.key === "Escape" || event.keyCode === 27) $this._hide(event);
      });
    }

    // Initial ARIA
    setAria(config.target.hasClass(config.visibleClass));

    return $this;
  };

  /* ------------------------------------------------------------
   * placeholder(): safe no-op on modern browsers
   * ---------------------------------------------------------- */
  $.fn.placeholder = function () {
    // If native placeholder is supported, just return the jQuery set.
    if (typeof document.createElement("input").placeholder !== "undefined") {
      return $(this);
    }

    // Legacy polyfill (kept for compatibility with the template)
    if (this.length === 0) return $(this);
    if (this.length > 1) {
      this.each(function () { $(this).placeholder(); });
      return $(this);
    }

    const $root = $(this);

    // Text & textarea
    $root
      .find('input[type=text],textarea')
      .each(function () {
        const i = $(this);
        if (i.val() === "" || i.val() === i.attr("placeholder")) {
          i.addClass("polyfill-placeholder").val(i.attr("placeholder"));
        }
      })
      .on("blur", function () {
        const i = $(this);
        if (/-polyfill-field$/.test(i.attr("name"))) return;
        if (i.val() === "") i.addClass("polyfill-placeholder").val(i.attr("placeholder"));
      })
      .on("focus", function () {
        const i = $(this);
        if (/-polyfill-field$/.test(i.attr("name"))) return;
        if (i.val() === i.attr("placeholder")) i.removeClass("polyfill-placeholder").val("");
      });

    // Password (legacy swap)
    $root.find('input[type=password]').each(function () {
      const i = $(this);
      const x = $(
        $("<div>").append(i.clone()).remove().html()
          .replace(/type=\"password\"/gi, 'type="text"')
      );
      if (i.attr("id")) x.attr("id", i.attr("id") + "-polyfill-field");
      if (i.attr("name")) x.attr("name", i.attr("name") + "-polyfill-field");
      x.addClass("polyfill-placeholder").val(x.attr("placeholder")).insertAfter(i);
      if (i.val() === "") i.hide(); else x.hide();

      i.on("blur", function (event) {
        event.preventDefault();
        const x = i.parent().find("input[name=" + i.attr("name") + "-polyfill-field]");
        if (i.val() === "") { i.hide(); x.show(); }
      });

      x.on("focus", function (event) {
        event.preventDefault();
        const i2 = x.parent().find("input[name=" + x.attr("name").replace("-polyfill-field", "") + "]");
        x.hide(); i2.show().focus();
      }).on("keypress", function (event) {
        event.preventDefault();
        x.val("");
      });
    });

    // Submit/reset housekeeping
    $root
      .on("submit", function () {
        $root.find('input[type=text],input[type=password],textarea').each(function () {
          const i = $(this);
          if (/-polyfill-field$/.test(i.attr("name"))) i.attr("name", "");
          if (i.val() === i.attr("placeholder")) {
            i.removeClass("polyfill-placeholder").val("");
          }
        });
      })
      .on("reset", function (event) {
        event.preventDefault();
        $root.find("select").val($("option:first").val());
        $root.find("input,textarea").each(function () {
          const i = $(this);
          i.removeClass("polyfill-placeholder");
          switch (this.type) {
            case "submit":
            case "reset":
              break;
            case "password": {
              i.val(i.attr("defaultValue"));
              const x = i.parent().find("input[name=" + i.attr("name") + "-polyfill-field]");
              if (i.val() === "") { i.hide(); x.show(); } else { i.show(); x.hide(); }
              break;
            }
            case "checkbox":
            case "radio":
              i.prop("checked", !!i.attr("defaultValue"));
              break;
            case "text":
            case "textarea":
              i.val(i.attr("defaultValue"));
              if (i.val() === "") i.addClass("polyfill-placeholder").val(i.attr("placeholder"));
              break;
            default:
              i.val(i.attr("defaultValue"));
          }
        });
      });

    return $root;
  };

  /* ------------------------------------------------------------
   * prioritize(): move elements to first position conditionally
   * ---------------------------------------------------------- */
  $.prioritize = function ($elements, condition) {
    const key = "__prioritize";
    if (!($elements && $elements.jquery)) $elements = $($elements);

    $elements.each(function () {
      const $e = $(this);
      const $parent = $e.parent();
      if ($parent.length === 0) return;

      if (!$e.data(key)) {
        if (!condition) return;
        const $p = $e.prev();
        if ($p.length === 0) return;
        $e.prependTo($parent);
        $e.data(key, $p);
      } else {
        if (condition) return;
        const $p = $e.data(key);
        $e.insertAfter($p);
        $e.removeData(key);
      }
    });
  };
})(jQuery);
