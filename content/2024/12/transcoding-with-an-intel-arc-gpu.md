---
title: Transcoding with an Intel Arc GPU
date: '2024-12-20T18:30:51+00:00'
slug: transcoding-with-an-intel-arc-gpu
categories:
- Benchmarks
- General
- Technology
- Tweaking
tags:
- arc
- ffmpeg
- intel
- nvidia
- qsv
- transcoding
- video
---

I am a bit of an NVIDIA fanboy when it comes to GPUs. This is partly down to being a long time Linux Desktop user (until recently) and them having excellent drivers allowing me to pretty effortlessly get proper hardware acceleration working.

In my lab environment I have an old Nvidia Quadro P400 that's set up for various transcoding workloads and its been working absolutely great for me despite being an older card. I have been primarily using the h264 codec but I recently moved over to h265 (hevc) mostly out of curiosity, and to see if I could get quality on-par with h264, whilst getting similar file sizes.

<!--more-->

Seems simple? Take my existing ffmpeg command (using qmax of 23), and substituting the output codec from h264 to hevc whilst keeping everything else the same, This gets me a file encoded with hevc thats similar (ever so slightly larger) than what I'd have with h264 and comparable quality. I can pixel peep a few frames to see the differences but I could also calculate a [VMAF score](https://en.wikipedia.org/wiki/Video_Multimethod_Assessment_Fusion) for these two outputs (between 0 and 100) to give a subjective quality score compared to the original source file. Doing so, the hevc encoded output scores slightly higher for an ever so slightly larger file. Anecdotal posts on the internet suggest a score between 94 and 96 is acceptable, but higher is better. Ultimately its up to you what you consider acceptable quality.

**This is all well and good, but where does Intel Arc come into this?**

I managed to find an Intel Arc A310 for pretty cheap and figured I'd grab one to throw into my lab. On paper this is a much newer card so should have decent performance for encoding - and it also natively supports AV1 acceleration if I ever wanted to experiment with that in the future. My goal is to find a good balance of quality, file size, speed and compatability.

The codecs used for NVIDIA and Intel Quick Sync (QSV) don't accept all the same inputs, so using the new GPU is not as simple as just replacing hevc\_nvenc codec with hevc\_qsv. This shouldn't be much a problem though as they are different pieces of hardware so will naturally do things differently.

ICQ (Intelligent Constant Quality) parameters for the Arc GPU are controlled using `-global_quality` instead of `-qmax` and I picked a starting number of 15 as it gave me a file size slightly larger than NVENC's h264 whilst 16 gives a smaller file using my test input.

In order to validate our subjective quality, the VMAF score should decrease as the ICQ number increases so I tested all the way from 15 through 19. With ICQ, lower numbers are better quality and larger files, whilst larger numbers are worse quality, but smaller files. Since using qmax 23 for NVENC was larger than h264, I also included qmax 24 in my results.

<a href="/images/2024/12/vmaf.png"><img alt="" class="img-center" height="305" src="/images/2024/12/vmaf.png" width="984"/></a>

Looking at these, using an ICQ value of 15, 16 or 17 gives us supposedly a superior quality file, but only 16 and 17 result in a smaller file than we get with NVENC qmax 23. All of these resulting tests are still ***significantly*** smaller than the original untranscoded file, and only two are larger than the h264 transcoded file using the P400, so in order to get the best balance of quality and size it seems like a value of 16 is optimal, at least for my hardware and use case.

Quality is subjective and all results will depend on the source and what you find personally acceptable, but the encoding improvements from using newer hardware really shows here - I can get a better quality hevc file, with a smaller footprint and do it faster (The A310 is almost twice as fast as the P400) so using this in my lab moving forward seems like a no-brainer.

Results will of course vary depending on what input you use. I only tested this with a single file for writing this post, but I have seen similar results for a variety of other inputs.

For completeness, these are the ffmpeg commands I used (ffmpeg version 7.1). I am by no means an expert with ffmpeg, so there are probably plenty of ways to further tune this but for now I'm happy with my results.

```console
# NVENC
# Adjust qmax to control ICQ and file size
    ffmpeg -v quiet -loglevel error -stats -y \
        -hwaccel cuda \
        -hwaccel_output_format cuda \
        -i "input.mkv" \
        -fps_mode passthrough \
        -c:s copy \
        -c:a copy \
        -c:v hevc_nvenc \
        -map 0 \
        -dn \
        -preset medium \
        -profile:v main \
        -spatial_aq:v 1 \
        -rc-lookahead 32 \
        -rc vbr \
        -qmin:v 16 -qmax:v 23 \
        -vtag hvc1 \
        -max_muxing_queue_size 4096 \
        -f matroska \
        "output.mkv"

# Intel QuickSync
# Adjust global_quality to control ICQ and file size
   ffmpeg -v quiet -loglevel error -stats -y \
       -hwaccel qsv \
       -hwaccel_output_format qsv \
        -i "input.mkv" \
       -fps_mode passthrough \
       -c:s copy \
       -c:a copy \
       -c:v hevc_qsv \
       -map 0 \
       -dn \
       -preset medium \
       -profile:v main \
       -look_ahead 1 \
       -look_ahead_depth 99 \
       -global_quality 16 \
       -extbrc 1 \
       -vtag hvc1 \
       -max_muxing_queue_size 4096 \
       -f matroska \
        "output.mkv"

# Calculating VMAF (requires Netflix VMAF library)
# Uses CPU, Adjust n_threads for your CPU
   ffmpeg -y \
       -i "generated_ouput.mkv" \
       -i "input.mkv" \
       -lavfi libvmaf=n_subsample=5:n_threads=16 -f null -
```
