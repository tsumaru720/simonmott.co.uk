(function () {
  var params = new URLSearchParams(window.location.search);
  var query = (params.get('s') || '').trim();
  var input = document.getElementById('keywords');
  if (input && query) {
    input.value = query;
  }

  var resultsEl = document.getElementById('search-results');
  var countEl = document.getElementById('search-count');
  if (!resultsEl) return;

  function render(list) {
    if (countEl) {
      countEl.textContent = list.length === 1 ? 'One article found.' : list.length + ' articles found.';
    }
    if (!list.length) {
      resultsEl.innerHTML = '<p class="intro" style="margin-top: 0;">No articles found.</p>';
      return;
    }
    var html = '<ul class="post-list">';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      html += '<li><article><a href="' + item.url + '">'
        + '<h2>' + item.title + '</h2>'
        + '<div class="meta"><time datetime="' + item.date + '">' + item.date_display + '</time></div>'
        + '<p>' + item.snippet + '</p>'
        + '</a></article></li>';
    }
    html += '</ul>';
    resultsEl.innerHTML = html;
  }

  if (!query) {
    countEl.textContent = '';
    resultsEl.innerHTML = '<p class="intro" style="margin-top: 0;">Type a term in the box above to search the site.</p>';
    return;
  }

  fetch('/search.json')
    .then(function (r) { return r.json(); })
    .then(function (index) {
      var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      var scored = [];
      for (var i = 0; i < index.length; i++) {
        var entry = index[i];
        var haystack = (entry.title + ' ' + entry.text).toLowerCase();
        var hit = true;
        for (var j = 0; j < terms.length; j++) {
          if (haystack.indexOf(terms[j]) === -1) { hit = false; break; }
        }
        if (hit) {
          var pos = haystack.indexOf(terms[0]);
          var start = Math.max(0, pos - 60);
          entry.snippet = (start > 0 ? '&hellip; ' : '') + entry.text.substr(start, 240) + ' &hellip;';
          scored.push(entry);
        }
      }
      render(scored);
    })
    .catch(function () {
      resultsEl.innerHTML = '<p>Search is currently unavailable.</p>';
    });
})();
