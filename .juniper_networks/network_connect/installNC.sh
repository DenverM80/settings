
# Install the service

if [ "$#" -lt "1" ]
then
    echo "Insufficiant number of parameters"
    echo "$0 <install dir>"
    exit;
fi

if [ -e "$1/ncsvc" ] 
then
    echo "Service needs to be reinstalled."
else
    echo "Service needs to be installed for the first time."
fi

# determine platform
OS=`uname -s`
if [ "${OS}" = "Linux" ] ; then
    if [ -f /etc/redhat-release ] ; then
        DIST="REDHAT"
    elif [ -f /etc/SUSE-release ] ; then
        DIST="SUSE"
    elif [ -f /etc/debian_version ] ; then
        DIST="UBUNTU"
    fi
fi

retry=1
ok="try"
until [ "$ok" = "done" ]
do
    # use sudo on Ubuntu since it has root account disabled by default
    # su to root on all other platforms
    if [ "${DIST}" = "UBUNTU" ] ; then
        echo "Please enter the sudo password"
        sudo install -m 6711 -o root $1/../tmp/ncsvc $1/ncsvc
    elif [ "${DIST}" = "REDHAT" ] ; then
        tmp=`expr $retry % 2`
        if [ $tmp -eq 1 ] ; then
           echo "Please enter the sudo password"
           sudo install -m 6711 -o root $1/../tmp/ncsvc $1/ncsvc
        else
           echo "Please enter the root/su password"
           su root -c "install -m 6711 -o root $1/../tmp/ncsvc $1/ncsvc"
        fi
    else
        echo "Please enter the root/su password"
        su root -c "install -m 6711 -o root $1/../tmp/ncsvc $1/ncsvc"
    fi

    if [ "$?" -eq "0" ] 
    then
        install -m 744 $1/../tmp/ncdiag $1/ncdiag
        cp $1/../tmp/version.txt $1/
        ok="done"
        rm -rf $1/../tmp
    else
        retry=`expr $retry + 1` 
        echo "Invalid password and/or Unable to install ncsvc"
        echo -n "Do you want to try again (enter y to try again):";
        read choice;            
        if [ "$choice" != "y" ]
        then 
            ok="done"
        fi
    fi
done
