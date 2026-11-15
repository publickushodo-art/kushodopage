/* ページ内をスムーズにスクロールするようになるやつ */
$(function(){
  $('a[href^="#"]'+'a:not(".carousel-control-prev")'+'a:not(".carousel-control-next")'+'a:not(".collapsed")'+'a:not(".text-body")').click(function(){
    var speed = 500; /* ここで移動の速さ変更できる */
    var href= $(this).attr("href");
    var target = $(href == "#" || href == "" ? 'html' : href);
    var position = target.offset().top;
    $("html, body").animate({scrollTop:position}, speed, "swing");
    return false; /* URLに影響を与えない */
  });
});

/* ページトップにとぶボタンの表示設定 */
$(function() {
    var topBtn = $('#page-top');    
    topBtn.hide();
    $(window).scroll(function () {
        if ($(this).scrollTop() > 250) { /* スクロールが250に達したらボタンを表示 */
            topBtn.fadeIn();
        } else {
            topBtn.fadeOut();
        }
    });
    /* スクロールしてトップにいく */
    topBtn.click(function () {
        $('body,html').animate({
            scrollTop: 0
        }, 500);
        return false;
    });
});