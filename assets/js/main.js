/*
	Dimension by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

/*
  main.js — modernized for HTML5 UP Dimension
  - Removes dependency on breakpoints.min.js and browser.min.js
  - Keeps jQuery (ships with the template)
  - Restores preload fade-in and article transition animations
  - Matches original behavior (hash-based routing, ESC to close, scroll restore)
*/

(function ($) {
  var $window = $(window),
      $body = $('body'),
      $wrapper = $('#wrapper'),
      $header = $('#header'),
      $footer = $('#footer'),
      $main = $('#main'),
      $main_articles = $main.children('article');

  // Play initial animations on page load (remove preload class).
  $window.on('load', function () {
    window.setTimeout(function () {
      $body.removeClass('is-preload');
    }, 100);
  });

  // Nav middle alignment (unchanged from original).
  var $nav = $header.children('nav'),
      $nav_li = $nav.find('li');
  if ($nav_li.length % 2 === 0) {
    $nav.addClass('use-middle');
    $nav_li.eq(($nav_li.length / 2)).addClass('is-middle');
  }

  // Main logic.
  var delay = 325,
      locked = false;

  // Show an article by id (without the '#').
  $main._show = function (id, initial) {
    var $article = $main_articles.filter('#' + id);
    if ($article.length === 0) return;

    // If locked (or initial load), do a fast show without delays.
    if (locked || (typeof initial !== 'undefined' && initial === true)) {
      $body.addClass('is-switching');
      $body.addClass('is-article-visible');
      $main_articles.removeClass('active');
      $header.hide();
      $footer.hide();
      $main.show();
      $article.show();
      $article.addClass('active');
      locked = false;
      setTimeout(function () { $body.removeClass('is-switching'); }, (initial ? 1000 : 0));
      return;
    }

    // Lock interactions during transition.
    locked = true;

    if ($body.hasClass('is-article-visible')) {
      // Swap articles.
      var $current = $main_articles.filter('.active');
      $current.removeClass('active');
      setTimeout(function () {
        $current.hide();
        $article.show();
        setTimeout(function () {
          $article.addClass('active');
          $window.scrollTop(0);
          setTimeout(function () { locked = false; }, delay);
        }, 25);
      }, delay);
    } else {
      // First time showing main/article.
      $body.addClass('is-article-visible');
      setTimeout(function () {
        $header.hide();
        $footer.hide();
        $main.show();
        $article.show();
        setTimeout(function () {
          $article.addClass('active');
          $window.scrollTop(0);
          setTimeout(function () { locked = false; }, delay);
        }, 25);
      }, delay);
    }
  };

  // Hide the currently active article.
  $main._hide = function (addState) {
    var $article = $main_articles.filter('.active');
    if (!$body.hasClass('is-article-visible')) return;

    if (typeof addState !== 'undefined' && addState === true)
      history.pushState(null, null, '#');

    if (locked) {
      $body.addClass('is-switching');
      $article.removeClass('active');
      $article.hide();
      $main.hide();
      $footer.show();
      $header.show();
      $body.removeClass('is-article-visible');
      locked = false;
      $body.removeClass('is-switching');
      $window.scrollTop(0);
      return;
    }

    locked = true;
    $article.removeClass('active');
    setTimeout(function () {
      $article.hide();
      $main.hide();
      $footer.show();
      $header.show();
      setTimeout(function () {
        $body.removeClass('is-article-visible');
        $window.scrollTop(0);
        setTimeout(function () { locked = false; }, delay);
      }, 25);
    }, delay);
  };

  // Inject close buttons + stop propagation within articles.
  $main_articles.each(function () {
    var $this = $(this);
    $('<div class="close">Close</div>')
      .appendTo($this)
      .on('click', function () { location.hash = ''; });
    $this.on('click', function (event) { event.stopPropagation(); });
  });

  // Global events.
  $body.on('click', function () {
    if ($body.hasClass('is-article-visible')) $main._hide(true);
  });

  $window.on('keyup', function (event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
      if ($body.hasClass('is-article-visible')) $main._hide(true);
    }
  });

  $window.on('hashchange', function (event) {
    if (location.hash === '' || location.hash === '#') {
      event.preventDefault();
      event.stopPropagation();
      $main._hide();
    } else if ($main_articles.filter(location.hash).length > 0) {
      event.preventDefault();
      event.stopPropagation();
      $main._show(location.hash.substring(1));
    }
  });

  // Prevent auto scroll on hash change.
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  } else {
    var oldScrollPos = 0,
        scrollPos = 0,
        $htmlbody = $('html,body');
    $window.on('scroll', function () {
      oldScrollPos = scrollPos;
      scrollPos = $htmlbody.scrollTop();
    }).on('hashchange', function () {
      $window.scrollTop(oldScrollPos);
    });
  }

  // Initialize: hide main/articles, then open hash target on load if present.
  $main.hide();
  $main_articles.hide();
  if (location.hash && location.hash !== '#') {
    $window.on('load', function () { $main._show(location.hash.substring(1), true); });
  }

})(jQuery);
