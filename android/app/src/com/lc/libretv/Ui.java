package com.lc.libretv;

import android.app.Activity;
import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.view.*;
import android.widget.*;
import android.util.LruCache;
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

final class Ui {
 static final int BG=0xff111114, PANEL=0xff26242c, MUTED=0xffaaa8b3, ACCENT=0xffe3dafa;
 static final ExecutorService images=Executors.newFixedThreadPool(3);
 static final LruCache<String,Bitmap> cache=new LruCache<String,Bitmap>(16*1024*1024){protected int sizeOf(String key,Bitmap b){return b.getByteCount();}};
 static int dp(Context c,int n){return (int)(n*c.getResources().getDisplayMetrics().density+.5f);}
 static TextView text(Context c,String s,int size,int color){TextView t=new TextView(c);t.setText(s);t.setTextSize(size);t.setTextColor(color);t.setFontFeatureSettings("kern");return t;}
 static GradientDrawable bg(int a,int b,int radius){GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{a,b});d.setCornerRadius(radius);return d;}
 static Button button(Context c,String label,View.OnClickListener click){Button b=new Button(c);b.setText(label);b.setTextSize(15);b.setTextColor(Color.WHITE);b.setAllCaps(false);b.setBackgroundResource(R.drawable.focus_button);b.setOnClickListener(click);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(0);b.setMinimumHeight(0);b.setPadding(dp(c,8),dp(c,6),dp(c,8),dp(c,6));return b;}
 static void focus(View v){v.setFocusable(true);v.setFocusableInTouchMode(false);v.setBackgroundResource(R.drawable.focus_button);v.setOnFocusChangeListener((view,yes)->{view.setElevation(yes?dp(view.getContext(),5):0);view.animate().scaleX(yes?1.025f:1f).scaleY(yes?1.025f:1f).setDuration(120).start();});}
 static LinearLayout.LayoutParams lp(Context c,int w,int h){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(w<0?w:dp(c,w),h<0?h:dp(c,h));p.setMargins(dp(c,5),dp(c,5),dp(c,5),dp(c,5));return p;}
 static void image(Activity activity,ImageView view,String url){
  view.setBackgroundColor(0xff242229);view.setScaleType(ImageView.ScaleType.FIT_CENTER);view.setTag(url);
  if(url==null||!url.startsWith("http"))return;
  Bitmap cached=cache.get(url);if(cached!=null){view.setImageBitmap(cached);return;}
  images.submit(()->{try{
   HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(4000);c.setReadTimeout(5000);c.setRequestProperty("User-Agent",Api.UA);
   if(url.contains("douban"))c.setRequestProperty("Referer","https://movie.douban.com/");
   byte[] bytes;try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){out.write(buf,0,n);if(out.size()>6*1024*1024)throw new IOException();}bytes=out.toByteArray();}finally{c.disconnect();}
   BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,o);o.inSampleSize=1;while(o.outWidth/o.inSampleSize>800)o.inSampleSize*=2;o.inJustDecodeBounds=false;
   Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length,o);if(bitmap==null)return;cache.put(url,bitmap);
   activity.runOnUiThread(()->{if(!activity.isFinishing()&&url.equals(view.getTag()))view.setImageBitmap(bitmap);});
  }catch(Exception ignored){}});
 }
}
