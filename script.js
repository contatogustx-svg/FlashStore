(function(){
var items=[],count=document.getElementById('count'),toast=document.getElementById('toast'),t;
function say(m){toast.textContent=m;toast.classList.add('show');clearTimeout(t);t=setTimeout(function(){toast.classList.remove('show')},1800)}
document.querySelectorAll('.buy').forEach(function(b){
b.addEventListener('click',function(){items.push(b.dataset.item);count.textContent=items.length;say(b.dataset.item+' adicionado ao carrinho')})});
document.getElementById('cartBtn').addEventListener('click',function(){say(items.length?items.length+' item(ns): '+items.join(', '):'Seu carrinho está vazio')});
})();
