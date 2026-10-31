package com.lc.libretv;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.media.MediaPlayer;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.*;
import java.net.*;
import java.security.MessageDigest;

public class PlayerActivity extends Activity {
    Api api; VideoView video; TextView top,bottom; ProgressBar loading; MediaPlayer media;
    float speed=1f; int introSeconds=0,tailSeconds=0; String series; boolean tailHandled=false,isLive=false,isNas=false;
    final java.util.concurrent.ExecutorService network=java.util.concurrent.Executors.newSingleThreadExecutor();
    final Handler handler=new Handler();
    JSONArray episodes;int index;String title,url,bookmark;
    int resumeAt=0,seekStep=15000;boolean prepared=false,proxy=false,autoFallback=false,stopped=false;
    int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    final Runnable hide=()->{top.setVisibility(View.GONE);bottom.setVisibility(View.GONE);};
    final Runnable ticker=new Runnable(){public void run(){
        if(prepared){updateTime();savePosition();if(!isLive&&tailSeconds>0&&!tailHandled&&video.getDuration()>(introSeconds+tailSeconds+30)*1000&&video.getCurrentPosition()>=video.getDuration()-tailSeconds*1000){tailHandled=true;nextEpisode();}}handler.postDelayed(this,1000);
    }};
    @Override public void onCreate(Bundle state){
        super.onCreate(state);api=new Api(this);api.cookie=getIntent().getStringExtra("cookie");
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN|WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,WindowManager.LayoutParams.FLAG_FULLSCREEN|WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        try{episodes=new JSONArray(getIntent().getStringExtra("episodes"));}catch(Exception e){finish();return;}
        index=getIntent().getIntExtra("index",0);title=getIntent().getStringExtra("title");
        isNas=getIntent().getBooleanExtra("isNas",false);isLive=getIntent().getBooleanExtra("isLive",false);series="skip_"+digest(getIntent().getStringExtra("seriesKey")==null?title:getIntent().getStringExtra("seriesKey"));
        introSeconds=api.prefs.getInt(series+"_intro",0);tailSeconds=api.prefs.getInt(series+"_tail",0);if(isNas){introSeconds=0;tailSeconds=0;}
        FrameLayout frame=new FrameLayout(this);frame.setBackgroundColor(Color.BLACK);
        video=new VideoView(this);FrameLayout.LayoutParams vp=new FrameLayout.LayoutParams(-1,-1,Gravity.CENTER);frame.addView(video,vp);
        top=new TextView(this);top.setTextSize(22);top.setTextColor(Color.WHITE);top.setPadding(dp(25),dp(18),dp(25),dp(18));top.setBackgroundColor(0xbb111827);frame.addView(top,new FrameLayout.LayoutParams(-1,-2,Gravity.TOP));
        bottom=new TextView(this);bottom.setTextSize(18);bottom.setTextColor(Color.WHITE);bottom.setPadding(dp(25),dp(16),dp(25),dp(16));bottom.setBackgroundColor(0xcc111827);frame.addView(bottom,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));
        loading=new ProgressBar(this);frame.addView(loading,new FrameLayout.LayoutParams(dp(55),dp(55),Gravity.CENTER));
        setContentView(frame);video.setFocusable(false);
        video.setOnPreparedListener(mp->{
            prepared=true;media=mp;loading.setVisibility(View.GONE);
            if(resumeAt>0&&resumeAt<video.getDuration()-5000)video.seekTo(resumeAt);
            video.start();if(speed!=1f)applySpeed(speed);showOverlay();
            mp.setOnInfoListener((player,what,extra)->{if(what==701)loading.setVisibility(View.VISIBLE);if(what==702||what==3)loading.setVisibility(View.GONE);return false;});
        });
        video.setOnErrorListener((mp,what,extra)->{
            prepared=false;loading.setVisibility(View.GONE);
            if(!proxy&&!autoFallback){autoFallback=true;proxy=true;open(false);return true;}
            top.setVisibility(View.VISIBLE);bottom.setVisibility(View.VISIBLE);handler.removeCallbacks(hide);
            bottom.setText("无法播放（"+what+" / "+extra+"） · "+(isNas?"请检查本地文件或重试":isLive?"请重试或选择其他频道":"请选择其他片源继续观看"));
            new AlertDialog.Builder(this).setTitle("播放失败").setMessage("当前连接播放失败。可以重试；网络视频可直接切换其他片源。")
                .setPositiveButton(isNas||isLive?"重试":"切换源",(d,w)->{if(isNas||isLive)open(false);else sourcePicker();}).setNeutralButton(isNas||isLive?"播放设置":"重试当前源",(d,w)->{if(isNas||isLive)menu();else open(false);}).setNegativeButton("关闭",null).show();return true;
        });
        video.setOnCompletionListener(mp->{
            nextEpisode();
        });
        open(true);handler.postDelayed(ticker,3000);
    }
    void open(boolean newEpisode){
        if(newEpisode){url=episodes.optString(index);bookmark="position_"+digest(getIntent().getStringExtra("playbackKey")+"|"+index);resumeAt=isLive?0:Math.max(introSeconds*1000,api.prefs.getInt(bookmark,0));}
        prepared=false;media=null;tailHandled=false;loading.setVisibility(View.VISIBLE);
        top.setText(title+(episodes.length()>1?" · 第"+(index+1)+"集":"")+"  /  "+(proxy?"电脑代理":"电视直连"));
        bottom.setText("正在加载… · 返回退出 · 菜单键可换播放方式");top.setVisibility(View.VISIBLE);bottom.setVisibility(View.VISIBLE);handler.removeCallbacks(hide);
        try{
            Uri original=Uri.parse(url);if(!"http".equals(original.getScheme())&&!"https".equals(original.getScheme()))throw new Exception("无效的视频地址");
            Map<String,String> headers=new HashMap<>();headers.put("User-Agent",Api.UA);
            String target=url;
            if(proxy){
                target=api.server()+(isLive?"/api/live/stream?url=":"/api/proxy?url=")+Api.enc(url);headers.put("Cookie",api.cookie==null?"":api.cookie);
                java.net.CookieManager jar=new java.net.CookieManager(null,CookiePolicy.ACCEPT_ORIGINAL_SERVER);
                if(api.cookie!=null&&!api.cookie.isEmpty()){
                    HttpCookie cookie=HttpCookie.parse(api.cookie).get(0);cookie.setPath("/");jar.getCookieStore().add(URI.create(api.server()),cookie);
                }
                CookieHandler.setDefault(jar);
            }
            video.stopPlayback();video.setVideoURI(Uri.parse(target),headers);
        }catch(Exception e){loading.setVisibility(View.GONE);bottom.setText("播放地址异常："+e.getMessage());}
    }
    String digest(String s){try{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(s.getBytes("UTF-8"));StringBuilder r=new StringBuilder();for(byte b:bytes)r.append(String.format(Locale.US,"%02x",b&255));return r.toString();}catch(Exception e){return String.valueOf(s.hashCode());}}
    String time(int ms){int sec=Math.max(0,ms/1000);return String.format(Locale.US,"%02d:%02d:%02d",sec/3600,(sec/60)%60,sec%60);}
    void updateTime(){bottom.setText((video.isPlaying()?"播放中":"已暂停")+"   "+(isLive?"直播":time(video.getCurrentPosition())+" / "+time(video.getDuration()))+"   "+speed+"×"+(isNas?"\n确认：暂停与控制栏 · 左右：跳转15秒 · 下键：字幕、音轨与播放设置":"\n确认：暂停/播放  · 左右：跳转15秒  · 下键 / 长按确认：选集、换源、倍速与跳过设置"));}
    void showOverlay(){top.setVisibility(View.VISIBLE);bottom.setVisibility(View.VISIBLE);if(prepared)updateTime();handler.removeCallbacks(hide);if(prepared&&video.isPlaying())handler.postDelayed(hide,6000);}
    void savePosition(){if(prepared&&!isLive&&bookmark!=null){resumeAt=video.getCurrentPosition();api.prefs.edit().putInt(bookmark,resumeAt).apply();}}
    void seek(int delta){if(!prepared||isLive)return;int dest=Math.max(0,Math.min(video.getDuration()-1000,video.getCurrentPosition()+delta));video.seekTo(dest);showOverlay();}
    void toggle(){if(!prepared)return;if(video.isPlaying())video.pause();else video.start();showOverlay();if(isNas&&!video.isPlaying())nasMenu();}
    void nextEpisode(){if(bookmark!=null)api.prefs.edit().remove(bookmark).apply();prepared=false;
        if(index+1<episodes.length()){index++;autoFallback=false;proxy=false;open(true);}else{video.pause();bottom.setVisibility(View.VISIBLE);bottom.setText("播放结束 · 按返回退出");handler.removeCallbacks(hide);}}
    void menu(){
        if(isNas){nasMenu();return;}showOverlay();Dialog dialog=new Dialog(this);LinearLayout panel=new LinearLayout(this);panel.setOrientation(1);panel.setPadding(dp(24),dp(18),dp(24),dp(20));panel.setBackground(Ui.bg(0xff192b3d,0xff0c1725,dp(18)));
        panel.addView(Ui.text(this,title+(isLive?" · 直播":" · 第"+(index+1)+"集"),25,Color.WHITE));panel.addView(Ui.text(this,"选集与播放设置",13,Ui.MUTED));
        LinearLayout actions=new LinearLayout(this);String[] labels=isLive?new String[]{"直连 / 代理","返回频道"}:new String[]{"选集","换源","倍速 "+speed+"×","跳过片头片尾","直连 / 代理"};
        for(int i=0;i<labels.length;i++){final int which=i;Button b=Ui.button(this,labels[i],v->{dialog.dismiss();if(isLive){if(which==0){savePosition();proxy=!proxy;autoFallback=true;open(false);}else finish();return;}if(which==0)episodePicker();if(which==1)sourcePicker();if(which==2)speedPicker();if(which==3)skipPicker();if(which==4){savePosition();proxy=!proxy;autoFallback=true;open(false);}});LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(48),1);p.setMargins(dp(4),dp(16),dp(4),dp(8));actions.addView(b,p);}panel.addView(actions);
        if(!isLive)panel.addView(Ui.text(this,"已记忆：片头 "+introSeconds+" 秒 · 片尾 "+tailSeconds+" 秒；换源会尽量保留当前集与播放进度",13,Ui.MUTED));
        dialog.setContentView(panel);Window w=dialog.getWindow();w.setBackgroundDrawableResource(android.R.color.transparent);w.setLayout(-1,-2);w.setGravity(Gravity.BOTTOM);dialog.show();w.setLayout(-1,-2);
    }
    void nasMenu(){
        showOverlay();Dialog d=new Dialog(this);LinearLayout panel=new LinearLayout(this);panel.setOrientation(1);panel.setPadding(dp(24),dp(18),dp(24),dp(20));panel.setBackground(Ui.bg(0xf52b2832,0xfa141318,dp(18)));
        panel.addView(Ui.text(this,title,22,Color.WHITE));panel.addView(Ui.text(this,"本地文件 · "+(prepared?time(video.getCurrentPosition())+" / "+time(video.getDuration()):"正在读取"),14,Ui.MUTED));
        LinearLayout row=new LinearLayout(this);String[] labels={prepared&&video.isPlaying()?"暂停":"继续播放","字幕","音轨","倍速 "+speed+"×","文件信息"};
        for(int i=0;i<labels.length;i++){final int n=i;row.addView(Ui.button(this,labels[i],v->{d.dismiss();if(n==0){if(prepared){if(video.isPlaying())video.pause();else video.start();showOverlay();}}if(n==1)trackPicker(true);if(n==2)trackPicker(false);if(n==3)speedPicker();if(n==4)new AlertDialog.Builder(this).setTitle("文件信息").setMessage(title+"\n时长："+time(prepared?video.getDuration():0)+"\n画面："+(media==null?"未知":media.getVideoWidth()+" × "+media.getVideoHeight())+"\n来源：电脑 NAS 影库").setPositiveButton("确定",null).show();}),new LinearLayout.LayoutParams(0,dp(52),1));}panel.addView(row);panel.addView(Ui.text(this,"左右键快退 / 快进 15 秒 · 返回键关闭控制栏",13,Ui.MUTED));d.setContentView(panel);d.show();d.getWindow().setBackgroundDrawableResource(android.R.color.transparent);d.getWindow().setLayout(-1,-2);d.getWindow().setGravity(Gravity.BOTTOM);
    }
    void trackPicker(boolean subtitles){
        if(!prepared||media==null){Toast.makeText(this,"文件尚未准备好",Toast.LENGTH_SHORT).show();return;}
        try{MediaPlayer.TrackInfo[] tracks=media.getTrackInfo();ArrayList<Integer> ids=new ArrayList<>();ArrayList<String> labels=new ArrayList<>();if(subtitles){ids.add(-1);labels.add("关闭字幕");}
        for(int i=0;i<tracks.length;i++){int type=tracks[i].getTrackType();if(subtitles?(type==MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_SUBTITLE||type==MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_TIMEDTEXT):type==MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO){ids.add(i);labels.add((subtitles?"字幕 ":"音轨 ")+(labels.size()+1)+" · "+tracks[i].getLanguage());}}
        if(ids.size()==(subtitles?1:0)){new AlertDialog.Builder(this).setTitle(subtitles?"字幕":"音轨").setMessage(subtitles?"此文件没有当前系统可用的内嵌字幕轨道。外挂字幕暂未接入。":"此文件没有可切换的音轨。").setPositiveButton("确定",null).show();return;}
        new AlertDialog.Builder(this).setTitle(subtitles?"选择字幕":"选择音轨").setItems(labels.toArray(new String[0]),(d,n)->{try{int id=ids.get(n);if(id<0){for(int type:new int[]{MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_SUBTITLE,MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_TIMEDTEXT}){int selected=media.getSelectedTrack(type);if(selected>=0)media.deselectTrack(selected);}}else media.selectTrack(id);showOverlay();}catch(Exception e){Toast.makeText(this,"当前解码方式不支持这条轨道",Toast.LENGTH_LONG).show();}}).setNegativeButton("取消",null).show();
        }catch(Exception e){Toast.makeText(this,"电视暂时无法读取轨道",Toast.LENGTH_LONG).show();}
    }
    void episodePicker(){Dialog dialog=new Dialog(this);LinearLayout panel=new LinearLayout(this);panel.setOrientation(1);panel.setPadding(dp(22),dp(16),dp(22),dp(16));panel.setBackgroundColor(Ui.BG);panel.addView(Ui.text(this,"选集 · 当前第"+(index+1)+"集",24,Color.WHITE));LinearLayout ranges=new LinearLayout(this),grid=new LinearLayout(this);grid.setOrientation(1);
        for(int i=0;i<episodes.length();i+=30){final int offset=i;Button b=Ui.button(this,(i+1)+"–"+Math.min(i+30,episodes.length()),v->episodePage(grid,offset,dialog));ranges.addView(b,Ui.lp(this,85,38));}HorizontalScrollView hs=new HorizontalScrollView(this);hs.addView(ranges);panel.addView(hs);ScrollView scroll=new ScrollView(this);scroll.addView(grid);panel.addView(scroll,new LinearLayout.LayoutParams(-1,dp(190)));episodePage(grid,index/30*30,dialog);dialog.setContentView(panel);dialog.show();dialog.getWindow().setLayout(dp(780),-2);}
    void episodePage(LinearLayout grid,int start,Dialog dialog){grid.removeAllViews();for(int i=start;i<Math.min(start+30,episodes.length());i+=8){LinearLayout row=new LinearLayout(this);for(int j=i;j<Math.min(i+8,Math.min(start+30,episodes.length()));j++){final int n=j;Button b=Ui.button(this,(n==index?"▶ ":"")+(n+1),v->{savePosition();index=n;autoFallback=false;proxy=false;open(true);dialog.dismiss();});row.addView(b,Ui.lp(this,78,40));}grid.addView(row);}}
    void speedPicker(){float[] speeds={.75f,1f,1.25f,1.5f,2f};String[] labels={"0.75×","1.0× 正常","1.25×","1.5×","2.0×"};new AlertDialog.Builder(this).setTitle("播放倍速").setItems(labels,(d,n)->applySpeed(speeds[n])).setNegativeButton("取消",null).show();}
    void applySpeed(float next){if(!prepared||media==null)return;try{if(Build.VERSION.SDK_INT<23)throw new Exception();boolean playing=video.isPlaying();media.setPlaybackParams(new android.media.PlaybackParams().setSpeed(next).setPitch(1f));speed=next;if(!playing)video.pause();showOverlay();}catch(Exception e){new AlertDialog.Builder(this).setMessage("电视当前解码方式不支持这个倍速，保持原速度。").setPositiveButton("确定",null).show();}}
    void skipPicker(){String[] choices={"设置片头（当前 "+introSeconds+" 秒）","设置片尾（当前 "+tailSeconds+" 秒）","关闭这部剧的自动跳过"};new AlertDialog.Builder(this).setTitle("按本剧记忆 · 手动设定时长").setItems(choices,(d,n)->{if(n==2){introSeconds=tailSeconds=0;api.prefs.edit().putInt(series+"_intro",0).putInt(series+"_tail",0).apply();return;}int[] values={0,30,60,90,120,150,180};String[] labels={"关闭","30秒","60秒","90秒","120秒","150秒","180秒"};new AlertDialog.Builder(this).setTitle(n==0?"跳过片头":"跳过片尾").setItems(labels,(x,k)->{if(n==0){introSeconds=values[k];if(prepared&&video.getCurrentPosition()<introSeconds*1000)video.seekTo(introSeconds*1000);}else tailSeconds=values[k];api.prefs.edit().putInt(series+"_intro",introSeconds).putInt(series+"_tail",tailSeconds).apply();tailHandled=false;showOverlay();}).setNegativeButton("取消",null).show();}).setNegativeButton("返回",null).show();}
    void sourcePicker(){Toast.makeText(this,"正在查找同名片源…",Toast.LENGTH_SHORT).show();network.submit(()->{try{
        JSONArray options=new JSONArray(getIntent().getStringExtra("alternatives")==null?"[]":getIntent().getStringExtra("alternatives"));
        if(options.length()<2){JSONArray configured=api.get("/api/status").optJSONArray("defaultSources");JSONObject result=api.post("/api/search",new JSONObject().put("wd",title).put("sources",configured).put("filterAdult",true));JSONArray list=result.optJSONArray("list");options=new JSONArray();if(list!=null)for(int i=0;i<list.length();i++){JSONObject v=list.optJSONObject(i);if(!v.optString("name").replace(" ","").equals(title.replace(" ","")))continue;for(int j=0;j<configured.length();j++){JSONObject s=configured.optJSONObject(j);if(s.optString("key").equals(v.optString("sourceKey")))options.put(new JSONObject().put("name",s.optString("name")).put("source",s).put("vodId",v.optString("vodId")));}}}
        final JSONArray choices=options;String[] labels=new String[choices.length()];for(int i=0;i<labels.length;i++)labels[i]=choices.optJSONObject(i).optString("name");runOnUiThread(()->{if(isFinishing())return;if(labels.length==0){Toast.makeText(this,"未找到其他同名片源",Toast.LENGTH_LONG).show();return;}new AlertDialog.Builder(this).setTitle("换源 · 保留当前进度").setItems(labels,(d,n)->switchSource(choices.optJSONObject(n))).setNegativeButton("取消",null).show();});
      }catch(Exception e){runOnUiThread(()->Toast.makeText(this,api.friendly(e),Toast.LENGTH_LONG).show());}});}
    void switchSource(JSONObject choice){savePosition();final int at=resumeAt;network.submit(()->{try{JSONObject source=choice.getJSONObject("source"),detail=api.get("/api/detail?id="+Api.enc(choice.optString("vodId"))+"&source="+Api.enc(source.toString()));JSONArray next=detail.optJSONArray("episodes");if(next==null||next.length()==0)throw new Exception("该片源暂无可播放地址");runOnUiThread(()->{if(isFinishing())return;episodes=next;index=Math.min(index,episodes.length()-1);getIntent().putExtra("playbackKey",source.optString("url")+"|"+choice.optString("vodId"));url=episodes.optString(index);bookmark="position_"+digest(getIntent().getStringExtra("playbackKey")+"|"+index);resumeAt=at;autoFallback=false;proxy=false;open(false);});}catch(Exception e){runOnUiThread(()->Toast.makeText(this,api.friendly(e),Toast.LENGTH_LONG).show());}});}
    @Override public boolean onKeyDown(int key,KeyEvent event){
        switch(key){
            case KeyEvent.KEYCODE_DPAD_CENTER:case KeyEvent.KEYCODE_ENTER:if(event.getRepeatCount()==0)event.startTracking();return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:if(event.getRepeatCount()==0)toggle();return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:seek(-seekStep);return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:seek(seekStep);return true;
            case KeyEvent.KEYCODE_MEDIA_REWIND:seek(-60000);return true;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:seek(60000);return true;
            case KeyEvent.KEYCODE_DPAD_UP:showOverlay();return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:if(event.getRepeatCount()==0)menu();return true;
            case KeyEvent.KEYCODE_MENU:if(event.getRepeatCount()==0)menu();return true;
        }return super.onKeyDown(key,event);
    }
    @Override public boolean onKeyUp(int key,KeyEvent event){
        if(key==KeyEvent.KEYCODE_DPAD_CENTER||key==KeyEvent.KEYCODE_ENTER){if(!event.isCanceled())toggle();return true;}
        return super.onKeyUp(key,event);
    }
    @Override public boolean onKeyLongPress(int key,KeyEvent event){
        if(key==KeyEvent.KEYCODE_DPAD_CENTER||key==KeyEvent.KEYCODE_ENTER){menu();return true;}
        return super.onKeyLongPress(key,event);
    }
    @Override public void onPause(){savePosition();if(video!=null)video.pause();super.onPause();}
    @Override public void onStop(){if(video!=null)video.stopPlayback();prepared=false;stopped=true;super.onStop();}
    @Override public void onResume(){super.onResume();if(stopped){stopped=false;open(false);}else if(prepared){showOverlay();}}
    @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);network.shutdownNow();if(video!=null)video.stopPlayback();super.onDestroy();}
}

