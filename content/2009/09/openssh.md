---
title: OpenSSH
date: '2009-09-05T23:49:45+00:00'
slug: openssh
categories:
- General
tags: []
---

Here you will find some tips and tricks for OpenSSH that I found useful. Note that the instructions on this page do not cover all the capabilities of OpenSSH and I advise you to use these commands at your own risk.

## SSH Aliases

If, like me, you have lots of servers and find it quite tedious to continually type "**ssh admin@server1.co.uk**" for all your servers, Aliases might be a god send!

To add an alias is really simple. Below is an example of an alias that shortens "**ssh admin@server1.co.uk**" to "**ssh s1**" (This can be further shortened with bash aliases which, at present, are not covered here).

<!--more-->

To do this, put the following in **/home/simon/.ssh/config**:

```ssh-config
Host s1
 HostName server1.co.uk
 User admin
```

For a full and complete list of config options see "**man ssh\_config**" on your server

## Keys

SSH keys allow you greater security whilst at the same time giving you easier access to machines you regularly need to SSH to. Keys come in pairs, you have a Public key and a Private key, Which as suggested, Private keys are, well, pivate and Public keys are public.

To generate a key pair, using your local machine type the following:

```console
$ ssh-keygen -t rsa -b 2048
```

Doing this will ask you to enter a pass phrase. At this stage it might be worth noting, if you provide a pass phrase, the key will not be usable for passwordless logins with SSH (e.g executing remote commands). If you want security, enter a pass phrase. It is recomended this be a sentence with a mix of words, numbers and symbols such as "!".

If you want to use this key for passwordless logins just simply press **Return** on your keyboard.

Once this is done you should be told that the key has been created successfully and you should also now have the location of the key pair

```console
Your identification has been saved in /home/simon/.ssh/id_rsa.
 Your public key has been saved in /home/simon/.ssh/id_rsa.pub.
 The key fingerprint is:
 91:c3:7f:d7:af:d1:e5:69:b4:fa:07:1f:17:8b:90:fe simon@shinobu
```

It is recomended that you never put your **id\_rsa** anywhere that cannot be trusted. Whilst in most cases it is only you that has access to your home folder, Superusers such as root can also.

To install a key onto a server you want to ssh to, simply put the contents of **id\_rsa.pub** into **/home/simon/.ssh/authorized\_keys** and change its permissions to 600 (rw-------)

We have a handy built in script called **ssh-copy-id** which does all that for you. Assuming your public key is in **/hom/simon/.ssh/id\_rsa.pub** then just type the following into a console:

```console
$ ssh-copy-id -i /home/simon/.ssh/id_rsa.pub admin@yourserver.com
```

You should now be prompted for your password. Once successfully logged in you will see something similar to:

```bash
Now try logging into the machine, with "ssh 'admin@yourserver.com'", and check in:
 
 .ssh/authorized_keys
 
 to make sure we haven't added extra keys that you weren't expecting.
```

The above copies the contents of your **id\_rsa.pub** to your server, appends its contents to your **authorized\_keys** file (or creates one if needed) and changes its permissions

Once this has been done try to SSH to your server and if you created the key with a pass phrase, you should be prompted for it. If you created a phrase-less key then you should be allowed into your server without any prompt.

If you fail to log in with the correct key then the OpenSSH daemon will, by default, revert to password authentication. If you do not want this to happen, please see below

## Agent and Agent Forwarding

Whilst having keys with pass phrases are more secure than standard passwords, it can be extremely monotonous to have to type it in every time you want to do anything that requires SSH especially if the phrase is a long sentance with symbols. To avoid this, we use **ssh-agent**

In order for us to be able to use SSH and not type a pass-phrase in we need to add our identity (see [keys](http://old.simonmott.co.uk/openssh#keys)) to our agent session. This needs to be done every time your desktop is started.

```console
$ ssh-add
 Identity added: /home/simon/.ssh/id_rsa (/home/simon/.ssh/id_rsa)
```

Once this is done, you will only need to type your pass phrase in once. You can SSH to your server and log out as many times as you want, it will only ask for the phrase once!

**Agent Forwarding** can be useful when you need to SSH to a server to work on. Lets say you need to then copy a file from that server to another, but the other server only allows access with SSH keys. You can forward your key to the new server without having to open a complete new SSH connection from your local machine. To do this all you need to do is add your identity to ssh-agent (see above) and add a flag to your SSH command:

```console
$ ssh -A admin@yourserver.com
```

The **-A** flag tells SSH to forward your identity which is stored on the server (assuming the server has Agent forwarding enabled). If keys are set up correctly you should be allowed access to this server without hiccup. Whilst connected to this server you can test SSH forwarding by trying to SSH to another server that has your Public key (see [keys](http://old.simonmott.co.uk/openssh#keys)).

```console
$ ssh admin@yourotherserver.com
```

If everything is set up correctly then you should now be on **yourotherserver.com** without having to type any passwords!

**SECURITY NOTE:** Using agent forwarding can leave you open to "Agent Hijacking". Whilst this does not give anyone your Key it does leave the doors open for them to use your Forwarded information to access servers you would normally have access to with your key. For more info please read this article: [Security Issues with Key Agents](http://unixwiz.net/techtips/ssh-agent-forwarding.html#sec)
