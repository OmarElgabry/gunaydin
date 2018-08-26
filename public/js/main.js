'use strict';

var app = function({ randNum, maxlength }){

  // variables
  randNum = parseInt(randNum);
  var curPageId = null;
  var offset = 0;
  var templates = [];
  var timeout;

  // start
  (function() {

    // initialize events 
    events();

    // update (fix) dates in links
    $('div.sidebar_slider_top:eq(0) .side_post .side_post_content small.post_meta span').each(function(i, ele) {
      let date = new Date($(ele).text());
      $(ele).text(formatDate(date));
    });

    // load templates
    ajax('GET', '/templates', null, function(err, response) {
      if(err) { return addPageError(err); }

      templates = response;
      
      let html = ``; 
      templates.map((template, tI) => { html += `<option value="${randNum^tI}">${template.name}</option>` })
      $('.post_comment select.comment_input').append(html);
    });
  })();

  // ajax
  function ajax(method, url, data, callback) {
    let request;

    if (method === "POST")        request = $.post(url, data);
    else if(method === "PUT")     request = $.ajax({ type: 'PUT', url, data });
    else if(method === "DELETE")  request = $.ajax({ type: 'DELETE', url });
    else                          request = $.get(url);

    request
    .done(function(response) {
      callback(null, response);
    }).fail(function(err) {
      callback(err);
    });
  }

  // events
  function events(last = false) {
    $('.similar_posts .post_tags li' + ((last)? ':last': '') + ' a.page-title').click(getPage);
    $('.similar_posts .post_tags li' + ((last)? ':last': '') + ' a.mute').click(mute);
    $('.similar_posts .post_tags li' + ((last)? ':last': '') + ' a.refresh').click(refresh);
    $('.similar_posts .post_tags li' + ((last)? ':last': '') + ' a.delete').click(deletePage);
    
    // only first time events
    if(!last) { 
      $('.post_comment form button').click(addPage); 
      $('.post_comment select').change(addSampleUrls);
      $('#load_more').click(loadMore);
    }
  }

  // events callbacks
  function addSampleUrls(e) {        
    let tI = getId($(this).val());
    let container = '.post_comment small.sample-urls';
    $(container).css('display', 'none');
    if(isNaN(tI) || !templates[tI] || !templates[tI].sampleUrls) { return; }
  
    let html = ``;
    templates[tI].sampleUrls.map(url => { html += `<br> <a href="javascript:void(0)">${url}</a>`});
    $(container).children('a, br').remove();
    $(container).append(html);
    $(container).children('a').click(function(e) {
      e.preventDefault();
      copyToClipboard($(this).text());
    });

    $(container).css('display', 'block');
  };

  function loadMore(e) {
    let container  = 'div.sidebar_slider_top:eq(0) > div';
    if(!curPageId && curPageId !== 0) { return; }

    $(container).css('opacity', 0.7);
    ajax('GET', `/user/page/${curPageId}?offset=${++offset}`, null, function(err, response) {
      $(container).css('opacity', 1);
      if(err) {  return pageOpError(err); }

      // add links, page title, and last update
      let html = '';
      response.links.map(link => { html += linkHTML(link) });
      $(container).append(html);
      $('#load_more').css('display', ((html)? 'block': 'none'));
      
    });
  }

  function getPage(e) {
    e.preventDefault();

    let container  = 'div.sidebar_slider_top:eq(0) > div';
    let pageId = getId($(this).parent().attr('id'));
    if(pageId === curPageId) { return; }

    $(container).css('opacity', 0.7);
    let notifications = $(this).parent().children('a.page-options.notifications');
    ajax('GET', `/user/page/${pageId}`, null, function(err, response) {

      $(container).css('opacity', 1);
      if(err) {  return pageOpError(err); }

      // add links, page title, and last update
      let html = '';
      response.links.map(link => { html += linkHTML(link) });

      $(container).html(html);
      $('.sidebar_title:eq(0) > div').html(pageMeta(response));
      $('.sidebar_title:eq(0) > span').text('Latest');
      $('#load_more').css('display', ((html)? 'block': 'none'));

      // clear page notifications
      $(notifications).remove();

      // update current page
      curPageId = pageId;
      offset = 0;
    });
  }

  function addPage(e) {
    e.preventDefault();

    let container = '.post_comment_form_container';
    let form  = $(this).parent();
    let pageUrl = $(form).children('input[name="link"]').val().trim();
    let title = $(form).children('input[name="title"]').val().trim();
    let tI    = getId($(form).children('select.comment_input').val());

    let error = validatePage({ pageUrl, tI });
    if(error) { return addPageError(error); }
    
    let page = {
      templateId: templates[tI]._id,
      pageUrl,
      title: (title || templates[tI].name).substr(0, maxlength)
    }

    $(container).css('opacity', 0.7);
    ajax('POST', `/user/page`, page, function(err, response) {
      $(container).css('opacity', 1);
      if(err || response.error) { return pageOpError(err || response.error); }

      $('.post_tags ul .no-data').remove();
      $('.post_tags ul').append(pageHTML({ title: page.title, url: page.pageUrl }));
      // clear existing data
      $(form).children('input[name="link"]').val('');
      $(form).children('input[name="title"]').val('');

      events(true);
    });
  }

  function mute(e) {
    e.preventDefault();

    let pageId = getId($(this).parent().attr('id'));
    let icon = $(this).children('i');
    let muted = $(icon).hasClass('fa-bell-slash')? false: true;

    ajax('PUT', `/user/page`, { pI: pageId, muted }, function(err, response) {
      if(err) { return pageOpError(err); }
      $(icon).attr('class', 'fa fa-bell' + ((muted)? '-slash': ''));
    })
  }

  function refresh(e) {
    let pageId = getId($(this).parent().attr('id'));

    ajax('GET', `/user/page/${pageId}/refresh`, null, function(err, response) {
      if(err || response.error) { return pageOpError(err || response.error); }
      pageOpSuccess(response.message);
    });
  }

  function deletePage(e) {
    e.preventDefault();

    if (!confirm("Are you sure?")) { return; }

    let pageIdOri = $(this).parent().attr('id');
    let pageId = getId(pageIdOri);

    ajax('DELETE', `/user/page/${pageId}`, null, function(err, response) {
      if(err || response.error) { return pageOpError(err || response.error); }
      $('.post_tags ul li#' + pageIdOri).remove();
      
      // Reload the page to reload the pages list.
      // This is important to re-index the pages displayed.
      location.reload();    
    });
  }

  // html
  function pageMeta(page){
    let date = formatDate(new Date(page.lastUpdate));
    return `<small class="post_meta" style="margin:0;"><b>${encodeHTML(page.title)}</b></small>
    <small class="post_meta" style="margin:0;">
      ${(date)? 'Last update: ' + date: ''}
    </small>`;
  }

  function pageHTML(page) {
    let pageId = $('.post_tags li.post_tag').length;
    return `<li class="post_tag" id="${getId(pageId)}">
      <a href="javascript:void(0)" class="pull-right page-options delete" title="Delete" style="color: indianred;"><i class="fa fa-trash"></i></a>
      <a href="javascript:void(0)" class="pull-right page-options refresh" title="Refresh"><i class="fa fa-refresh"></i></a>
      <a href="javascript:void(0)" class="pull-right page-options mute" title="Mute (Don't update)"><i class="fa fa-bell"></i></a>
      <a href="${encodeHTML(page.url)}" class="pull-right page-options" title="Open link" target="_blank"><i class="fa fa-link"></i></a>
      <a class="page-title" href="javascript:void(0)" >${encodeHTML(page.title)}</a>
    </li>`;
  }
  
  function linkHTML(link) {
    link.image = (link.image)? link.image: '/img/link.png';
    link.date = formatDate(new Date(link.date));

    return `<div class="side_post">
      <a href="${link.url}" target="_blank">
        <div class="d-flex flex-row align-items-xl-center align-items-start justify-content-start" style="padding-top:5px;">
          <div class="side_post_image">
            <div><img src="${link.image}" alt=""></div></div>
            <div class="side_post_content">
              <div class="side_post_title">${link.title}</div>
              <small class="post_meta post-content">${link.content || '' }</small>
              <small class="post_meta">${link.date} ${(link.author)? `<span>By ${link.author}</span>`: ''}</small>
            </div>
          </div>
        </a>
    </div>`
  }

  // helpers
  function validatePage({ pageUrl, tI }) {
    if(!pageUrl || !templates[tI]) {
      return 'Missing required fields.';
    } 

    // check if page url matches
    var regexp = new RegExp(`^${templates[tI].regex}$`, 'i');
    if(!regexp.test(pageUrl)) {
      return `The page url is invalid. <br> Please take a look at the samples or report a bug.`
    }
  }

  function getId(Id){
    Id = parseInt(Id); 
    return isNaN(Id) ? -1: (randNum ^ Id) ;
  }

  function encodeHTML (str){
    return $('<div />').text(str).html();
  }

  function formatDate(date) {
    if(isNaN(date.getTime()) || date.getFullYear() < 2010) { return ''; }

    var monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    var day = date.getDate();
    var monthIndex = date.getMonth();
    var year = date.getFullYear();
    
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    // minutes = minutes < 10 ? '0' + minutes : minutes;
    var clock = hours + /*':' + minutes +*/ ampm;

    return clock + ' ' + day + ', ' + monthNames[monthIndex] + ' ' + year;
  }

  function copyToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
  
    try {
      var successful = document.execCommand('copy');
      if(successful) { addPageSuccess('URL has been copied to clipboard.') }
    } catch (err) {}
  
    document.body.removeChild(textArea);
  }

  // message: error and success
  function pageOpError(msg) {
    message('error', '.similar_posts .card-body', msg);
  }

  function pageOpSuccess(msg) {
    message('success', '.similar_posts .card-body', msg);
  }

  function addPageError(msg) {
    message('error', '.post_comment_form_container', msg);
  }

  function addPageSuccess(msg) {
    message('success', '.post_comment_form_container', msg);
  }

  function message(type, container, msg) {
    if(msg && msg.constructor !== String) { 
      msg = 'We are facing an internal error. Please try again later.';
    }

    msg = msg.replace(/\n/g, "<br />");
    let html = `<span class="text-${(type === 'error')? 'danger': 'success'} message" style='font-size: 12px;'>${msg}</span>`;
    $(container).children('span.message').remove();
    $(container).append(html);

    clearTimeout(timeout);
    timeout = setTimeout(function(){ $(`${container} > .message`).remove(); }, 5000);
  }
}; 